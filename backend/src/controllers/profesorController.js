const bcrypt = require('bcrypt');
const db = require('../config/db');
const Proyecto = require('../models/Proyecto');
const HorarioProfesor = require('../models/HorarioProfesor');
const Usuario = require('../models/Usuario');
const { uploadedFilePath } = require('../utils/fileUrl');


function normalizarLista(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(',');
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean).join(',');
  } catch (_error) {}
  return String(value).split(',').map((v) => v.trim()).filter(Boolean).join(',');
}

function rutaProyectoArchivo(file) {
  return uploadedFilePath(file, 'proyectos');
}

function obtenerArchivosProyecto(req) {
  const principal = req.files?.img_principal?.[0] || req.file || null;
  const media = [...(req.files?.media || [])];
  // La portada se guarda por separado. No debe duplicarse dentro de la galeria.
  const mediaNormalizada = media.map((file) => ({
    ...file,
    ruta_archivo: rutaProyectoArchivo(file),
    nombre_original: file.originalname,
    mime_type: file.mimetype,
  })).filter((file) => file.ruta_archivo);
  return { principalRuta: principal ? rutaProyectoArchivo(principal) : null, media: mediaNormalizada };
}

const obtenerIdProfesorDesdeToken = async (req) => {
  const id_usuario = req.usuario.id_usuario;
  const [rows] = await db.query('SELECT * FROM profesores WHERE id_profesor = ?', [id_usuario]);
  return rows.length > 0 ? rows[0] : null;
};

exports.listarProyectos = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });

    const proyectos = await Proyecto.findByProfesor(profesor.id_profesor);
    return res.status(200).json({ ok: true, proyectos });
  } catch (error) {
    console.error('Error en listarProyectos (Profesor):', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.crearProyecto = async (req, res) => {
  try {
    const {
      titulo, descripcion, estado, tecnologias, area_trabajo,
      ambito_desarrollo, es_innovacion, ya_trabaja, competencia_impacto,
      objetivo, actividades
    } = req.body;

    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });
    if (!titulo || !String(titulo).trim()) return res.status(400).json({ ok: false, mensaje: 'El título es obligatorio' });

    const { principalRuta, media } = obtenerArchivosProyecto(req);

    const id_proyecto = await Proyecto.create({
      id_profesor: profesor.id_profesor,
      titulo: String(titulo).trim(),
      descripcion,
      area_trabajo: area_trabajo || null,
      ambito_desarrollo: normalizarLista(ambito_desarrollo) || null,
      es_innovacion: es_innovacion ? 1 : 0,
      ya_trabaja: ya_trabaja ? 1 : 0,
      competencia_impacto: competencia_impacto || null,
      objetivo: objetivo || null,
      actividades: actividades || null,
      estado: estado || 'en progreso',
      img_principal: principalRuta,
      tecnologias: normalizarLista(tecnologias) || null
    });

    if (media.length) await Proyecto.addMedia(id_proyecto, media);

    const proyecto = await Proyecto.findById(id_proyecto);
    return res.status(201).json({ ok: true, mensaje: 'Proyecto registrado correctamente', proyecto });
  } catch (error) {
    console.error('Error en crearProyecto (Profesor):', error);
    return res.status(500).json({ ok: false, mensaje: error.message || 'Error interno del servidor' });
  }
};


exports.actualizarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo, descripcion, estado, tecnologias, area_trabajo,
      ambito_desarrollo, es_innovacion, ya_trabaja, competencia_impacto,
      objetivo, actividades
    } = req.body;

    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });

    const proyectoExistente = await Proyecto.findById(id);
    if (!proyectoExistente || Number(proyectoExistente.id_profesor) !== Number(profesor.id_profesor)) {
      return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
    }

    const { principalRuta, media } = obtenerArchivosProyecto(req);
    const img_principal = principalRuta || proyectoExistente.img_principal;

    await Proyecto.update(id, {
      titulo: String(titulo || proyectoExistente.titulo).trim(),
      descripcion,
      area_trabajo: area_trabajo || null,
      ambito_desarrollo: normalizarLista(ambito_desarrollo) || null,
      es_innovacion: es_innovacion ? 1 : 0,
      ya_trabaja: ya_trabaja ? 1 : 0,
      competencia_impacto: competencia_impacto || null,
      objetivo: objetivo || null,
      actividades: actividades || null,
      estado: estado || 'en progreso',
      img_principal,
      tecnologias: normalizarLista(tecnologias) || null
    });

    if (media.length) await Proyecto.addMedia(id, media);

    const proyecto = await Proyecto.findById(id);
    return res.status(200).json({ ok: true, mensaje: 'Proyecto actualizado correctamente', proyecto });
  } catch (error) {
    console.error('Error en actualizarProyecto (Profesor):', error);
    return res.status(500).json({ ok: false, mensaje: error.message || 'Error interno del servidor' });
  }
};


exports.eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });

    const proyecto = await Proyecto.findById(id);
    if (!proyecto || Number(proyecto.id_profesor) !== Number(profesor.id_profesor)) {
      return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
    }

    await Proyecto.delete(id);
    return res.status(200).json({ ok: true, mensaje: 'Proyecto eliminado correctamente' });
  } catch (error) {
    console.error('Error en eliminarProyecto (Profesor):', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.obtenerDashboard = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });

    const usuario = await Usuario.findById(req.usuario.id_usuario);
    const proyectos = await Proyecto.findByProfesor(profesor.id_profesor);
    const horarios = await HorarioProfesor.findByProfesor(profesor.id_profesor);

    return res.status(200).json({
      ok: true,
      dashboard: {
        usuario,
        profesor,
        resumen: {
          proyectos: proyectos.length,
          horarios: horarios.length
        }
      }
    });
  } catch (error) {
    console.error('Error al cargar dashboard de profesor:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al cargar dashboard' });
  }
};

exports.obtenerAlumnos = async (_req, res) => {
  return res.status(403).json({ ok: false, mensaje: 'Los profesores no tienen acceso al directorio completo de alumnos.' });
};

exports.listarEvidencias = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false });

    const [evidencias] = await db.query(`
      SELECT e.*, p.titulo as proyecto_titulo
      FROM evidencias e
      JOIN proyectos p ON e.id_proyecto = p.id_proyecto
      WHERE p.id_profesor = ?
      ORDER BY e.fecha_subida DESC
    `, [profesor.id_profesor]);

    res.status(200).json({ ok: true, evidencias });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: 'Error al listar evidencias' });
  }
};

exports.subirEvidencia = async (req, res) => {
  try {
    const { id_proyecto, tipo } = req.body;
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });

    const proyecto = await Proyecto.findById(id_proyecto);
    if (!proyecto || Number(proyecto.id_profesor) !== Number(profesor.id_profesor)) {
      return res.status(403).json({ ok: false, mensaje: 'No puedes agregar documentos a este proyecto.' });
    }

    const archivo = req.file ? req.file.path : null;
    if (!archivo) return res.status(400).json({ ok: false, mensaje: 'Archivo requerido' });

    await db.query(
      'INSERT INTO evidencias (id_proyecto, ruta_archivo, tipo) VALUES (?, ?, ?)',
      [id_proyecto, archivo, tipo || 'archivo']
    );

    res.status(200).json({ ok: true, mensaje: 'Evidencia subida correctamente' });
  } catch (error) {
    console.error('Error al subir evidencia de profesor:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al subir evidencia' });
  }
};

exports.obtenerPerfil = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    const usuario = await Usuario.findById(req.usuario.id_usuario);
    return res.json({ ok: true, usuario, profesor });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar perfil' });
  }
};

exports.actualizarPerfil = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id_usuario = req.usuario.id_usuario;
    const { nombre, apellido, telefono, departamento, asignaturas, grado_academico, especialidad, biografia, linkedin, orcid, horario_atencion, mentorias, nueva_password } = req.body;

    if (!nombre || !apellido) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre y apellido son obligatorios.' });
    }
    if (nueva_password && String(nueva_password).length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const fotoPerfil = uploadedFilePath(req.file, 'perfiles');
    const passwordHash = nueva_password ? await bcrypt.hash(String(nueva_password), 10) : null;

    await conn.beginTransaction();

    const usuarioUpdates = ['nombre = ?', 'apellido = ?', 'telefono = ?'];
    const params = [nombre, apellido, telefono || null];
    if (fotoPerfil) { usuarioUpdates.push('foto_perfil = ?'); params.push(fotoPerfil); }
    if (passwordHash) { usuarioUpdates.push('password_hash = ?'); params.push(passwordHash); }
    params.push(id_usuario);

    await conn.query(`UPDATE usuarios SET ${usuarioUpdates.join(', ')} WHERE id_usuario = ?`, params);
    await conn.query(
      `UPDATE profesores
       SET departamento = ?, asignaturas = ?, grado_academico = ?, especialidad = ?, biografia = ?, linkedin = ?, orcid = ?, horario_atencion = ?, mentorias = ?
       WHERE id_profesor = ?`,
      [departamento || null, asignaturas || null, grado_academico || null, especialidad || null, biografia || null, linkedin || null, orcid || null, horario_atencion || null, String(mentorias) === 'true', id_usuario]
    );

    await conn.commit();

    const usuario = await Usuario.findById(id_usuario);
    const profesor = await obtenerIdProfesorDesdeToken(req);
    return res.json({ ok: true, mensaje: 'Perfil actualizado correctamente.', usuario, profesor });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error actualizando profesor:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar perfil' });
  } finally {
    if (conn) conn.release();
  }
};

exports.listarMisHorarios = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });
    const horarios = await HorarioProfesor.findByProfesor(profesor.id_profesor);
    return res.json({ ok: true, horarios });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar horarios' });
  }
};

exports.subirMiHorario = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });

    const { titulo, descripcion } = req.body;
    const ruta_pdf = req.file ? req.file.path : null;
    const tipo_archivo = req.file?.mimetype?.startsWith('image/') ? 'imagen' : 'pdf';
    if (!titulo || !ruta_pdf) {
      return res.status(400).json({ ok: false, mensaje: 'Título y archivo PDF o imagen son obligatorios' });
    }

    const id_horario = await HorarioProfesor.create({ id_profesor: profesor.id_profesor, titulo, descripcion, ruta_pdf, tipo_archivo });
    return res.status(201).json({ ok: true, mensaje: 'Horario subido correctamente', id_horario });
  } catch (error) {
    console.error('Error subiendo horario:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al subir horario' });
  }
};

exports.eliminarMiHorario = async (req, res) => {
  try {
    const profesor = await obtenerIdProfesorDesdeToken(req);
    if (!profesor) return res.status(404).json({ ok: false, mensaje: 'Profesor no encontrado' });

    const [rows] = await db.query('SELECT id_horario FROM horarios_profesores WHERE id_horario = ? AND id_profesor = ? LIMIT 1', [req.params.id, profesor.id_profesor]);
    if (!rows.length) return res.status(404).json({ ok: false, mensaje: 'Horario no encontrado' });

    await HorarioProfesor.delete(req.params.id);
    return res.json({ ok: true, mensaje: 'Horario eliminado correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar horario' });
  }
};
