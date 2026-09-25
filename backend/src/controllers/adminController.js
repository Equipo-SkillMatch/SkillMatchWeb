const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const db = require('../config/db');
const Usuario = require('../models/Usuario');
const Empresa = require('../models/Empresa');
const Vacante = require('../models/Vacante');
const { uploadedFilePath } = require('../utils/fileUrl');

const ROL_ADMIN = 1;
const ROL_VINCULACION = 5;
const EMPRESA_ESTADOS = ['pendiente', 'habilitada', 'deshabilitada', 'rechazada'];
const VACANTE_ESTADOS = ['abierta', 'pausada', 'cerrada'];

function getRol(req) {
  return Number(req.usuario?.id_rol);
}

function esAdmin(req) {
  return getRol(req) === ROL_ADMIN;
}

function esVinculacion(req) {
  return getRol(req) === ROL_VINCULACION;
}

function requireAdmin(req, res) {
  if (!esAdmin(req)) {
    res.status(403).json({ ok: false, mensaje: 'Solo el administrador puede acceder a este módulo.' });
    return false;
  }
  return true;
}

function requireVinculacion(req, res) {
  if (!esVinculacion(req)) {
    res.status(403).json({ ok: false, mensaje: 'Solo Vinculación puede gestionar empresas, vacantes y postulaciones.' });
    return false;
  }
  return true;
}

function requireAdminOVinculacion(req, res) {
  if (!esAdmin(req) && !esVinculacion(req)) {
    res.status(403).json({ ok: false, mensaje: 'No tienes permisos para acceder a este panel.' });
    return false;
  }
  return true;
}

exports.getAdminDashboard = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    if (esVinculacion(req)) {
      const [stats, empresas, vacantes, postulaciones, candidatos, reportes] = await Promise.all([
        Admin.getVinculacionStats(),
        Admin.getAllEmpresas(),
        Admin.getAllVacantes(),
        Admin.getAllPostulaciones(),
        Admin.getCandidatosVinculacion(),
        Admin.getReportesVinculacion(),
      ]);

      return res.status(200).json({
        ok: true,
        rolPanel: 'vinculacion',
        data: { stats, empresas, vacantes, postulaciones, candidatos, reportes },
      });
    }

    const [stats, empresas, alumnos, profesores, proyectos] = await Promise.all([
      Admin.getGlobalStats(),
      Admin.getAllEmpresas(),
      Admin.getAllAlumnos(),
      Admin.getAllProfesores(),
      Admin.getAllProyectos(),
    ]);

    return res.status(200).json({
      ok: true,
      rolPanel: 'admin',
      data: { stats, empresas, alumnos, profesores, proyectos },
    });
  } catch (error) {
    console.error('Error en Dashboard Admin/Vinculación:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar los datos administrativos desde el servidor' });
  }
};

exports.getEmpresaDetalle = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    const empresa = await Admin.getEmpresaDetalle(req.params.id);
    if (!empresa) return res.status(404).json({ ok: false, mensaje: 'Empresa no encontrada' });
    return res.json({ ok: true, empresa, permisos: { puedeGestionar: esVinculacion(req) } });
  } catch (error) {
    console.error('Error al obtener empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle de empresa' });
  }
};

exports.crearEmpresaVinculacion = async (req, res) => {
  if (!requireVinculacion(req, res)) return;

  const conn = await db.getConnection();
  try {
    const {
      razon_social, rfc, domicilio, ubicacion, giro, sector,
      responsable_nombre, responsable_apellido, responsable_cargo,
      responsable_correo, responsable_telefono, observaciones,
      correo, password, telefono, estado
    } = req.body;

    if (!razon_social || !rfc || !domicilio || !ubicacion || !responsable_nombre || !responsable_correo || !password) {
      return res.status(400).json({ ok: false, mensaje: 'Razón social, RFC, domicilio, ubicación, responsable, correo del responsable y contraseña son obligatorios.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const correoAcceso = correo || responsable_correo;
    const usuarioExistente = await Usuario.findByCorreo(correoAcceso);
    if (usuarioExistente) return res.status(409).json({ ok: false, mensaje: 'El correo ya está registrado.' });

    const [rfcExistente] = await db.query('SELECT id_empresa FROM empresas WHERE UPPER(rfc) = UPPER(?) LIMIT 1', [rfc]);
    if (rfcExistente.length) return res.status(409).json({ ok: false, mensaje: 'Ya existe una empresa registrada con ese RFC.' });

    const estadoFinal = EMPRESA_ESTADOS.includes(estado) ? estado : 'habilitada';

    await conn.beginTransaction();
    const password_hash = await bcrypt.hash(String(password), 10);
    const id_usuario = await Usuario.create({
      nombre: responsable_nombre,
      apellido: responsable_apellido || 'Responsable',
      correo: correoAcceso,
      password_hash,
      telefono: telefono || responsable_telefono || null,
      id_rol: 3,
      conn
    });

    await Empresa.create({
      id_usuario,
      razon_social,
      rfc: String(rfc).toUpperCase().trim(),
      domicilio,
      ubicacion,
      giro: giro || null,
      sector: sector || null,
      contacto: `${responsable_nombre} ${responsable_apellido || ''}`.trim(),
      responsable_nombre,
      responsable_apellido: responsable_apellido || null,
      responsable_cargo: responsable_cargo || null,
      responsable_correo,
      responsable_telefono: responsable_telefono || telefono || null,
      observaciones: observaciones || null,
      estado: estadoFinal,
      registrada_por: req.usuario.id_usuario,
      conn
    });
    await conn.commit();

    const empresa = await Admin.getEmpresaDetalle(id_usuario);
    return res.status(201).json({ ok: true, mensaje: `Empresa registrada correctamente en estado ${estadoFinal}.`, empresa });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error al crear empresa desde Vinculación:', error);
    return res.status(500).json({ ok: false, mensaje: error.message || 'Error al registrar empresa' });
  } finally {
    if (conn) conn.release();
  }
};


exports.updateEmpresa = async (req, res) => {
  if (!requireVinculacion(req, res)) return;

  try {
    if (req.body.estado && !EMPRESA_ESTADOS.includes(req.body.estado)) {
      return res.status(400).json({ ok: false, mensaje: 'Estado de empresa no válido' });
    }
    await Admin.updateEmpresa(req.params.id, req.body);
    const empresa = await Admin.getEmpresaDetalle(req.params.id);
    return res.json({ ok: true, mensaje: 'Empresa actualizada correctamente', empresa });
  } catch (error) {
    console.error('Error al actualizar empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar empresa' });
  }
};

exports.toggleEstadoEmpresa = async (req, res) => {
  if (!requireVinculacion(req, res)) return;

  const { id } = req.params;
  const { nuevoEstado } = req.body;

  if (!EMPRESA_ESTADOS.includes(nuevoEstado)) {
    return res.status(400).json({ ok: false, mensaje: 'Estado no válido' });
  }

  try {
    const [result] = await db.query('UPDATE empresas SET estado = ? WHERE id_empresa = ?', [nuevoEstado, id]);
    if (result.affectedRows === 0) return res.status(404).json({ ok: false, mensaje: 'Empresa no encontrada' });
    return res.status(200).json({ ok: true, mensaje: `La empresa quedó en estado ${nuevoEstado}` });
  } catch (error) {
    console.error('Error al cambiar estado de empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno al actualizar el estado' });
  }
};

exports.getAlumnoDetalle = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    const alumno = await Admin.getAlumnoDetalle(req.params.id);
    if (!alumno) return res.status(404).json({ ok: false, mensaje: 'Alumno no encontrado' });
    return res.json({ ok: true, alumno });
  } catch (error) {
    console.error('Error al obtener alumno:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle de alumno' });
  }
};

exports.getProfesorDetalle = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const profesor = await Admin.getProfesorDetalle(req.params.id);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });
    return res.json({ ok: true, profesor });
  } catch (error) {
    console.error('Error al obtener profesor:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle de profesor' });
  }
};

exports.getVacanteDetalle = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    const vacante = await Admin.getVacanteDetalle(req.params.id);
    if (!vacante) return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada' });
    return res.json({ ok: true, vacante, permisos: { puedeGestionar: esVinculacion(req) } });
  } catch (error) {
    console.error('Error al obtener vacante:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle de vacante' });
  }
};

exports.getProyectoDetalle = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const proyecto = await Admin.getProyectoDetalle(req.params.id);
    if (!proyecto) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
    return res.json({ ok: true, proyecto });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar detalle de proyecto' });
  }
};

exports.cambiarEstadoUsuario = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { estado } = req.body;
  if (!['activo', 'inactivo'].includes(estado)) {
    return res.status(400).json({ ok: false, mensaje: 'Estado de usuario no válido.' });
  }

  try {
    const affected = await Admin.cambiarEstadoUsuario(req.params.id, estado);
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado.' });
    return res.json({ ok: true, mensaje: estado === 'activo' ? 'Cuenta habilitada correctamente.' : 'Cuenta suspendida correctamente.' });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cambiar estado de usuario.' });
  }
};

exports.updateVacanteAdmin = async (req, res) => {
  if (!requireVinculacion(req, res)) return;

  try {
    const { estado } = req.body;
    if (!VACANTE_ESTADOS.includes(estado)) return res.status(400).json({ ok: false, mensaje: 'Estado de vacante no válido' });
    const affected = await Vacante.updateEstado(req.params.id, estado);
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada' });
    return res.json({ ok: true, mensaje: 'Estado de vacante actualizado' });
  } catch (error) {
    console.error('Error al actualizar vacante:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar vacante' });
  }
};

exports.obtenerMiPerfil = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    const usuario = await Usuario.findById(req.usuario.id_usuario);
    return res.json({ ok: true, usuario });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar perfil' });
  }
};

exports.actualizarMiPerfil = async (req, res) => {
  if (!requireAdminOVinculacion(req, res)) return;

  try {
    const id_usuario = req.usuario.id_usuario;
    const { nombre, apellido, telefono, cargo_institucional, area_institucional, extension, oficina, bio_profesional, nueva_password, confirmar_password } = req.body;
    if (!nombre || !apellido) return res.status(400).json({ ok: false, mensaje: 'Nombre y apellido son obligatorios.' });
    if (nueva_password && String(nueva_password).length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }
    if (nueva_password && nueva_password !== confirmar_password) {
      return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña y su confirmación no coinciden.' });
    }

    const updates = ['nombre = ?', 'apellido = ?', 'telefono = ?', 'cargo_institucional = ?', 'area_institucional = ?', 'extension = ?', 'oficina = ?', 'bio_profesional = ?'];
    const params = [nombre, apellido, telefono || null, cargo_institucional || null, area_institucional || null, extension || null, oficina || null, bio_profesional || null];
    if (req.file) { updates.push('foto_perfil = ?'); params.push(uploadedFilePath(req.file, 'perfiles')); }
    if (nueva_password) { updates.push('password_hash = ?'); params.push(await bcrypt.hash(String(nueva_password), 10)); }
    params.push(id_usuario);

    await db.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id_usuario = ?`, params);
    const usuario = await Usuario.findById(id_usuario);
    return res.json({ ok: true, mensaje: 'Perfil actualizado correctamente', usuario });
  } catch (error) {
    console.error('Error actualizando perfil admin/vinculación:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar perfil' });
  }
};

exports.listarChatbot = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const [items] = await db.query(`
      SELECT id_pregunta, pregunta, respuesta, categoria, keywords, activa
      FROM chatbot
      ORDER BY categoria ASC, id_pregunta DESC
    `);
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar configuración del chatbot' });
  }
};

exports.crearChatbot = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { pregunta, respuesta, categoria, keywords, activa } = req.body;
    if (!pregunta || !respuesta) return res.status(400).json({ ok: false, mensaje: 'Pregunta y respuesta son obligatorias.' });
    await db.query(
      `INSERT INTO chatbot (pregunta, respuesta, categoria, keywords, activa) VALUES (?, ?, ?, ?, ?)`,
      [pregunta, respuesta, categoria || 'general', keywords || null, activa === false ? false : true]
    );
    return res.status(201).json({ ok: true, mensaje: 'Respuesta del chatbot agregada' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al guardar respuesta del chatbot' });
  }
};

exports.actualizarChatbot = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { pregunta, respuesta, categoria, keywords, activa } = req.body;
    await db.query(
      `UPDATE chatbot SET pregunta = ?, respuesta = ?, categoria = ?, keywords = ?, activa = ? WHERE id_pregunta = ?`,
      [pregunta, respuesta, categoria || 'general', keywords || null, activa === false ? false : true, req.params.id]
    );
    return res.json({ ok: true, mensaje: 'Respuesta del chatbot actualizada' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar respuesta del chatbot' });
  }
};

exports.eliminarChatbot = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    await db.query('DELETE FROM chatbot WHERE id_pregunta = ?', [req.params.id]);
    return res.json({ ok: true, mensaje: 'Respuesta del chatbot eliminada' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar respuesta del chatbot' });
  }
};

// Compatibilidad: el admin ya no sube horarios. Los horarios ahora los gestiona cada profesor.
exports.obtenerProfesoresParaSelect = async (_req, res) => res.status(403).json({ ok: false, mensaje: 'Los horarios los sube cada profesor desde su panel.' });
exports.listarHorarios = async (_req, res) => res.status(403).json({ ok: false, mensaje: 'Los horarios los gestiona cada profesor.' });
exports.subirHorario = async (_req, res) => res.status(403).json({ ok: false, mensaje: 'Admin/Vinculación no puede subir horarios de profesores.' });
exports.eliminarHorario = async (_req, res) => res.status(403).json({ ok: false, mensaje: 'Admin/Vinculación no puede eliminar horarios de profesores.' });
