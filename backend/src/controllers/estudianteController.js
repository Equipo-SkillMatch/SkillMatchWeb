const bcrypt = require('bcrypt');
const db = require('../config/db');
const Estudiante = require('../models/Estudiante');
const Proyecto = require('../models/Proyecto');
const Evidencia = require('../models/Evidencia');
const Usuario = require('../models/Usuario'); // Necesitamos este modelo para buscar al colaborador por correo
const SoftSkills = require('../models/SoftSkills');
const { uploadedFilePath } = require('../utils/fileUrl');

const MAX_CUATRIMESTRE = 11;

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
  const media = [
    ...(req.files?.media || []),
  ];

  // La portada se guarda por separado. No debe duplicarse dentro de la galeria.

  const mediaNormalizada = media
    .map((file) => ({
      ...file,
      ruta_archivo: rutaProyectoArchivo(file),
      nombre_original: file.originalname,
      mime_type: file.mimetype,
    }))
    .filter((file) => file.ruta_archivo);

  const principalRuta = principal ? rutaProyectoArchivo(principal) : null;
  return { principalRuta, media: mediaNormalizada };
}


function parseFechaLocal(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
  }
  const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  }
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizarFechaISO(fecha) {
  const d = parseFechaLocal(fecha);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function primerLunesDelMes(year, monthIndex) {
  const d = new Date(year, monthIndex, 1, 12, 0, 0);
  const dia = d.getDay();
  const offset = dia === 1 ? 0 : (8 - dia) % 7;
  d.setDate(1 + offset);
  return d;
}

function inicioCuatriActual() {
  const hoy = new Date();
  const mes = hoy.getMonth();
  const mesInicio = mes < 4 ? 0 : mes < 8 ? 4 : 8; // enero, mayo o septiembre.
  return primerLunesDelMes(hoy.getFullYear(), mesInicio);
}

function calcularInicioEstimadoCarrera(estudiante = {}) {
  const cuatrimestre = Number(estudiante?.cuatrimestre_actual || estudiante?.semestre || estudiante?.cuatrimestre_inicial || 1);
  if (!Number.isFinite(cuatrimestre) || cuatrimestre < 1) return null;

  const inicioActual = inicioCuatriActual();
  const inicioEstimado = new Date(inicioActual);
  inicioEstimado.setMonth(inicioEstimado.getMonth() - ((Math.min(cuatrimestre, MAX_CUATRIMESTRE) - 1) * 4));
  return primerLunesDelMes(inicioEstimado.getFullYear(), inicioEstimado.getMonth());
}

function calcularSituacionAcademica(estudiante) {
  const inicial = Number(estudiante?.cuatrimestre_inicial || estudiante?.semestre || 1);
  const inicio = parseFechaLocal(estudiante?.fecha_inicio_carrera) || calcularInicioEstimadoCarrera(estudiante);

  if (!inicio) {
    const cuatrimestre = Math.min(Math.max(inicial, 1), MAX_CUATRIMESTRE);
    return {
      cuatrimestre_actual: cuatrimestre,
      estado_academico: estudiante?.estado_academico || 'activo',
      fecha_inicio_estimada_carrera: normalizarFechaISO(calcularInicioEstimadoCarrera({ ...estudiante, semestre: cuatrimestre })),
    };
  }

  const hoy = new Date();
  const mesesTranscurridos = Math.max(
    0,
    (hoy.getFullYear() - inicio.getFullYear()) * 12 + (hoy.getMonth() - inicio.getMonth())
  );
  const avance = Math.floor(mesesTranscurridos / 4);
  const calculado = inicial + avance;
  const fechaInicioEstimada = calcularInicioEstimadoCarrera({ ...estudiante, cuatrimestre_actual: Math.min(Math.max(calculado, 1), MAX_CUATRIMESTRE) });

  if (calculado > MAX_CUATRIMESTRE) {
    return {
      cuatrimestre_actual: MAX_CUATRIMESTRE,
      estado_academico: 'egresado',
      fecha_inicio_estimada_carrera: normalizarFechaISO(fechaInicioEstimada),
    };
  }

  return {
    cuatrimestre_actual: Math.max(calculado, 1),
    estado_academico: 'activo',
    fecha_inicio_estimada_carrera: normalizarFechaISO(fechaInicioEstimada),
  };
}

async function sincronizarSituacionAcademica(conn, estudiante) {
  const situacion = calcularSituacionAcademica(estudiante);

  if (
    Number(estudiante.semestre) !== Number(situacion.cuatrimestre_actual) ||
    estudiante.estado_academico !== situacion.estado_academico
  ) {
    await conn.query(
      `UPDATE estudiantes
       SET semestre = ?, estado_academico = ?
       WHERE id_estudiante = ?`,
      [situacion.cuatrimestre_actual, situacion.estado_academico, estudiante.id_estudiante]
    );
  }

  const fechaInicioEstimada = situacion.fecha_inicio_estimada_carrera || normalizarFechaISO(calcularInicioEstimadoCarrera({ ...estudiante, cuatrimestre_actual: situacion.cuatrimestre_actual }));

  return {
    ...estudiante,
    semestre: situacion.cuatrimestre_actual,
    cuatrimestre_actual: situacion.cuatrimestre_actual,
    estado_academico: situacion.estado_academico,
    fecha_inicio_carrera: normalizarFechaISO(estudiante.fecha_inicio_carrera),
    fecha_inicio_estimada_carrera: fechaInicioEstimada,
    anio_ingreso_estimado: fechaInicioEstimada ? Number(fechaInicioEstimada.slice(0, 4)) : null,
  };
}

// ==========================================
// OBTENER PERFIL PÚBLICO (CORREGIDO PARA COLABORADORES)
// ==========================================
exports.getPerfilPublico = async (req, res) => {
  const { id } = req.params;

  try {
    const [alumnoRows] = await db.query(`
      SELECT
        u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.foto_perfil,
        e.id_estudiante, e.matricula, e.carrera, e.semestre,
        e.cuatrimestre_inicial, e.fecha_inicio_carrera, e.estado_academico
      FROM usuarios u
      INNER JOIN estudiantes e ON u.id_usuario = e.id_estudiante
      WHERE u.id_usuario = ? AND u.id_rol = 2
    `, [id]);

    if (alumnoRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Estudiante no encontrado o el usuario no tiene rol de estudiante.'
      });
    }

    const alumno = await sincronizarSituacionAcademica(db, alumnoRows[0]);

    const [proyectosRows] = await db.query(`
      SELECT DISTINCT p.id_proyecto, p.titulo, p.descripcion, p.fecha_registro, p.estado
      FROM proyectos p
      WHERE p.id_estudiante = ?
      ORDER BY p.fecha_registro DESC
    `, [alumno.id_estudiante]);

    const habilidadesBlandas = await SoftSkills.getResultadoByEstudiante(alumno.id_estudiante).catch(() => null);

    return res.json({
      ok: true,
      alumno: { ...alumno, habilidades_blandas: habilidadesBlandas },
      proyectos: proyectosRows,
      habilidades_blandas: habilidadesBlandas
    });

  } catch (error) {
    console.error('Error real en el servidor:', error.message);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor al procesar los datos.'
    });
  }
};

// ==========================================
// ACTUALIZAR PERFIL DEL ESTUDIANTE
// ==========================================
exports.actualizarPerfil = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id_usuario = req.usuario.id_usuario;
    const {
      nombre,
      apellido,
      telefono,
      matricula,
      carrera,
      semestre,
      cuatrimestre_inicial,
      fecha_inicio_carrera,
      titulo_profesional, biografia, linkedin, github, portafolio, idiomas, disponibilidad, modalidad_preferida, ciudad,
      nueva_password
    } = req.body;

    if (!nombre || !apellido) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre y apellido son obligatorios.' });
    }

    const inicial = Number(cuatrimestre_inicial || semestre || 1);
    if (!Number.isInteger(inicial) || inicial < 1 || inicial > MAX_CUATRIMESTRE) {
      return res.status(400).json({ ok: false, mensaje: 'El cuatrimestre debe estar entre 1 y 11.' });
    }

    if (nueva_password && String(nueva_password).length < 8) {
      return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    const fechaInicioCapturada = normalizarFechaISO(fecha_inicio_carrera);
    const fechaInicio = fechaInicioCapturada || normalizarFechaISO(calcularInicioEstimadoCarrera({ semestre: inicial, cuatrimestre_inicial: inicial }));
    const situacion = calcularSituacionAcademica({
      cuatrimestre_inicial: inicial,
      semestre: inicial,
      fecha_inicio_carrera: fechaInicio,
    });

    const fotoPerfil = uploadedFilePath(req.file, 'perfiles');
    const passwordHash = nueva_password ? await bcrypt.hash(String(nueva_password), 10) : null;

    await conn.beginTransaction();

    const usuarioUpdates = ['nombre = ?', 'apellido = ?', 'telefono = ?'];
    const usuarioParams = [nombre, apellido, telefono || null];

    if (fotoPerfil) {
      usuarioUpdates.push('foto_perfil = ?');
      usuarioParams.push(fotoPerfil);
    }

    if (passwordHash) {
      usuarioUpdates.push('password_hash = ?');
      usuarioParams.push(passwordHash);
    }

    usuarioParams.push(id_usuario);

    await conn.query(
      `UPDATE usuarios SET ${usuarioUpdates.join(', ')} WHERE id_usuario = ?`,
      usuarioParams
    );

    await conn.query(
      `UPDATE estudiantes
       SET matricula = ?, carrera = ?, semestre = ?, cuatrimestre_inicial = ?,
           fecha_inicio_carrera = ?, estado_academico = ?,
           titulo_profesional = ?, biografia = ?, linkedin = ?, github = ?, portafolio = ?,
           idiomas = ?, disponibilidad = ?, modalidad_preferida = ?, ciudad = ?
       WHERE id_estudiante = ?`,
      [
        matricula || null,
        carrera || null,
        situacion.cuatrimestre_actual,
        inicial,
        fechaInicio,
        situacion.estado_academico,
        titulo_profesional || null,
        biografia || null,
        linkedin || null,
        github || null,
        portafolio || null,
        idiomas || null,
        disponibilidad || null,
        modalidad_preferida || null,
        ciudad || null,
        id_usuario
      ]
    );

    await conn.commit();

    const usuarioActualizado = await Usuario.findById(id_usuario);
    const estudianteActualizado = await Estudiante.findByUsuarioId(id_usuario);

    return res.status(200).json({
      ok: true,
      mensaje: 'Perfil actualizado con éxito.',
      usuario: usuarioActualizado,
      estudiante: {
        ...estudianteActualizado,
        cuatrimestre_actual: estudianteActualizado.semestre,
        fecha_inicio_carrera: normalizarFechaISO(estudianteActualizado.fecha_inicio_carrera),
        fecha_inicio_estimada_carrera: normalizarFechaISO(calcularInicioEstimadoCarrera({ ...estudianteActualizado, cuatrimestre_actual: estudianteActualizado.semestre })),
        anio_ingreso_estimado: Number(normalizarFechaISO(calcularInicioEstimadoCarrera({ ...estudianteActualizado, cuatrimestre_actual: estudianteActualizado.semestre }))?.slice(0, 4)) || null,
      }
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error en actualizarPerfil:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar el perfil.' });
  } finally {
    if (conn) conn.release();
  }
};

exports.eliminarCuenta = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id_usuario = req.usuario.id_usuario;

    await conn.beginTransaction();
    await conn.query(
      `UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = ? AND id_rol = 2`,
      [id_usuario]
    );
    await conn.query(
      `UPDATE estudiantes SET estado_academico = 'baja' WHERE id_estudiante = ?`,
      [id_usuario]
    );
    await conn.commit();

    return res.status(200).json({ ok: true, mensaje: 'Cuenta desactivada correctamente.' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Error en eliminarCuenta:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al desactivar la cuenta.' });
  } finally {
    if (conn) conn.release();
  }
};


// ==========================================
// FUNCIONES AUXILIARES Y GESTIÓN
// ==========================================

const obtenerIdEstudianteDesdeToken = async (req) => {
  const id_usuario = req.usuario.id_usuario;
  const estudiante = await Estudiante.findByUsuarioId(id_usuario);
  return estudiante;
};

exports.obtenerVacantes = async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const vacantes = await Estudiante.getVacantesDisponibles(id_usuario);
    
    return res.status(200).json({ ok: true, vacantes });
  } catch (error) {
    console.error('Error al obtener vacantes:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar las vacantes' });
  }
};

exports.postularVacante = async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const { id_vacante } = req.body;

    if (!id_vacante) {
      return res.status(400).json({ ok: false, mensaje: 'ID de vacante requerido' });
    }

    await Estudiante.postular(id_usuario, id_vacante);
    
    return res.status(201).json({ ok: true, mensaje: 'Postulación enviada correctamente' });
  } catch (error) {
    console.error('Error al postularse:', error);
    if (error.code === '23505' || error.mysqlCode === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, mensaje: 'Ya te has postulado a esta vacante' });
    }
    return res.status(500).json({ ok: false, mensaje: 'Error al procesar la postulación' });
  }
};

exports.obtenerDashboard = async (req, res) => {
  try {
    const estudianteBase = await obtenerIdEstudianteDesdeToken(req);

    if (!estudianteBase) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró el perfil del estudiante'
      });
    }

    const estudiante = await sincronizarSituacionAcademica(db, estudianteBase);
    const usuario = await Usuario.findById(req.usuario.id_usuario);
    const totalProyectos = await Proyecto.countByEstudiante(estudiante.id_estudiante);
    const totalDocumentos = await Evidencia.countByEstudiante(estudiante.id_estudiante);

    const habilidadesBlandas = await SoftSkills.getResultadoByEstudiante(estudiante.id_estudiante).catch(() => null);

    return res.status(200).json({
      ok: true,
      dashboard: {
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          correo: usuario.correo,
          telefono: usuario.telefono,
          foto_perfil: usuario.foto_perfil,
          estado: usuario.estado
        },
        estudiante: {
          id_estudiante: estudiante.id_estudiante,
          matricula: estudiante.matricula,
          carrera: estudiante.carrera,
          semestre: estudiante.semestre,
          cuatrimestre_actual: estudiante.cuatrimestre_actual,
          cuatrimestre_inicial: estudiante.cuatrimestre_inicial,
          fecha_inicio_carrera: estudiante.fecha_inicio_carrera,
          estado_academico: estudiante.estado_academico,
          competencias: estudiante.competencias,
          habilidades_blandas: habilidadesBlandas
        },
        habilidades_blandas: habilidadesBlandas,
        resumen: {
          proyectos_propios: totalProyectos,
          documentos: totalDocumentos
        }
      }
    });
  } catch (error) {
    console.error('Error en obtenerDashboard:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

exports.listarMisProyectos = async (req, res) => {
  try {
    const estudiante = await obtenerIdEstudianteDesdeToken(req);

    if (!estudiante) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró el perfil del estudiante'
      });
    }

    const proyectos = await Proyecto.findAllByEstudiante(estudiante.id_estudiante);

    return res.status(200).json({
      ok: true,
      proyectos
    });
  } catch (error) {
    console.error('Error en listarMisProyectos:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

exports.obtenerProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudiante = await obtenerIdEstudianteDesdeToken(req);

    if (!estudiante) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró el perfil del estudiante'
      });
    }

    const proyecto = await Proyecto.findByIdAndEstudiante(id, estudiante.id_estudiante);

    if (!proyecto) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Proyecto no encontrado'
      });
    }

    return res.status(200).json({
      ok: true,
      proyecto
    });
  } catch (error) {
    console.error('Error en obtenerProyecto:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

exports.crearProyecto = async (req, res) => {
  try {
    const { 
      titulo, descripcion, estado, tecnologias, area_trabajo,
      ambito_desarrollo, es_innovacion, ya_trabaja, competencia_impacto,
      objetivo, actividades
    } = req.body;

    const estudiante = await obtenerIdEstudianteDesdeToken(req);
    if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'No se encontró el perfil del estudiante' });

    if (!titulo || !String(titulo).trim()) return res.status(400).json({ ok: false, mensaje: 'El título es obligatorio' });
    if (!objetivo || !String(objetivo).trim()) return res.status(400).json({ ok: false, mensaje: 'El objetivo del proyecto es obligatorio' });
    if (!actividades || !String(actividades).trim()) return res.status(400).json({ ok: false, mensaje: 'Las actividades realizadas son obligatorias' });

    const estadosValidos = ['en progreso', 'completado', 'pausado'];
    const estadoFinal = estado || 'en progreso';
    if (!estadosValidos.includes(estadoFinal)) return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });

    const { principalRuta, media } = obtenerArchivosProyecto(req);

    const id_proyecto = await Proyecto.create({
      id_estudiante: estudiante.id_estudiante,
      titulo: String(titulo).trim(),
      descripcion: descripcion || null,
      area_trabajo: area_trabajo || null,
      ambito_desarrollo: normalizarLista(ambito_desarrollo) || null,
      es_innovacion: es_innovacion ? 1 : 0,
      ya_trabaja: ya_trabaja ? 1 : 0,
      competencia_impacto: competencia_impacto || null,
      objetivo: objetivo || null,
      actividades: actividades || null,
      estado: estadoFinal,
      img_principal: principalRuta, 
      tecnologias: normalizarLista(tecnologias) || null
    });

    if (media.length) await Proyecto.addMedia(id_proyecto, media);

    const proyecto = await Proyecto.findById(id_proyecto);
    return res.status(201).json({ ok: true, mensaje: 'Proyecto creado correctamente', proyecto });
  } catch (error) {
    console.error('Error en crearProyecto:', error);
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

    const estudiante = await obtenerIdEstudianteDesdeToken(req);
    if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'No se encontró el perfil del estudiante' });

    const proyectoExistente = await Proyecto.findByIdAndEstudiante(id, estudiante.id_estudiante);
    if (!proyectoExistente) return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });

    if (!titulo || !String(titulo).trim()) return res.status(400).json({ ok: false, mensaje: 'El título es obligatorio' });
    if (!objetivo || !String(objetivo).trim()) return res.status(400).json({ ok: false, mensaje: 'El objetivo del proyecto es obligatorio' });
    if (!actividades || !String(actividades).trim()) return res.status(400).json({ ok: false, mensaje: 'Las actividades realizadas son obligatorias' });

    const { principalRuta, media } = obtenerArchivosProyecto(req);
    const img_principal = principalRuta || proyectoExistente.img_principal;

    await Proyecto.update(id, {
      titulo: String(titulo).trim(),
      descripcion,
      area_trabajo: area_trabajo || null,
      ambito_desarrollo: normalizarLista(ambito_desarrollo) || null,
      es_innovacion: es_innovacion ? 1 : 0,
      ya_trabaja: ya_trabaja ? 1 : 0,
      competencia_impacto: competencia_impacto || null,
      objetivo: objetivo || null,
      actividades: actividades || null,
      estado: estado || proyectoExistente.estado || 'en progreso',
      img_principal, 
      tecnologias: normalizarLista(tecnologias) || null
    });

    if (media.length) await Proyecto.addMedia(id, media);

    const proyectoActualizado = await Proyecto.findById(id);
    return res.status(200).json({ ok: true, mensaje: 'Proyecto actualizado correctamente', proyecto: proyectoActualizado });
  } catch (error) {
    console.error('Error en actualizarProyecto:', error);
    return res.status(500).json({ ok: false, mensaje: error.message || 'Error interno del servidor' });
  }
};


exports.eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const estudiante = await obtenerIdEstudianteDesdeToken(req);

    if (!estudiante) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró el perfil del estudiante'
      });
    }

    const proyectoExistente = await Proyecto.findByIdAndEstudiante(id, estudiante.id_estudiante);

    if (!proyectoExistente) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Proyecto no encontrado'
      });
    }

    // Seguridad adicional: Solo el CREADOR puede eliminar el proyecto.
    if (proyectoExistente.id_estudiante !== estudiante.id_estudiante) {
        return res.status(403).json({
            ok: false,
            mensaje: 'No tienes permisos para eliminar este proyecto porque eres colaborador, no creador.'
        });
    }

    await Proyecto.delete(id);

    return res.status(200).json({
      ok: true,
      mensaje: 'Proyecto eliminado correctamente'
    });
  } catch (error) {
    console.error('Error en eliminarProyecto:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

// ==========================================
// FUNCIONES PARA GESTIÓN DE COLABORADORES 
// ==========================================

exports.agregarColaborador = async (req, res) => {
  try {
    const { id_proyecto } = req.params;
    const { correo_colaborador } = req.body;
    const creador = await obtenerIdEstudianteDesdeToken(req);

    if (!creador) return res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado.' });
    if (!correo_colaborador) return res.status(400).json({ ok: false, mensaje: 'El correo del colaborador es obligatorio.' });

    const proyecto = await Proyecto.findById(id_proyecto);
    if (!proyecto || proyecto.id_estudiante !== creador.id_estudiante) {
      return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para agregar colaboradores a este proyecto.' });
    }

    const usuarioColaborador = await Usuario.findByCorreo(correo_colaborador);
    if (!usuarioColaborador || usuarioColaborador.id_rol !== 2) {
      return res.status(404).json({ ok: false, mensaje: 'No se encontró a ningún estudiante con ese correo.' });
    }

    const estudianteColaborador = await Estudiante.findByUsuarioId(usuarioColaborador.id_usuario);
    if (!estudianteColaborador) {
        return res.status(404).json({ ok: false, mensaje: 'El perfil de estudiante del colaborador no existe.' });
    }

    if (estudianteColaborador.id_estudiante === creador.id_estudiante) {
      return res.status(400).json({ ok: false, mensaje: 'No puedes agregarte como colaborador a tu propio proyecto.' });
    }

    const affectedRows = await Proyecto.agregarColaborador(id_proyecto, estudianteColaborador.id_estudiante);
    
    if (affectedRows === 0) {
       return res.status(400).json({ ok: false, mensaje: 'Este estudiante ya es colaborador del proyecto.' });
    }

    return res.status(200).json({ ok: true, mensaje: 'Colaborador agregado correctamente.' });
  } catch (error) {
    console.error('Error en agregarColaborador:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al agregar colaborador.' });
  }
};

exports.obtenerColaboradores = async (req, res) => {
    try {
        const { id_proyecto } = req.params;
        const estudiante = await obtenerIdEstudianteDesdeToken(req);
    
        if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado.' });
    
        const proyecto = await Proyecto.findByIdAndEstudiante(id_proyecto, estudiante.id_estudiante);
        if (!proyecto) {
          return res.status(403).json({ ok: false, mensaje: 'No tienes acceso a este proyecto.' });
        }
    
        const colaboradores = await Proyecto.obtenerColaboradores(id_proyecto);
        return res.status(200).json({ ok: true, colaboradores });
      } catch (error) {
        console.error('Error en obtenerColaboradores:', error);
        return res.status(500).json({ ok: false, mensaje: 'Error al obtener colaboradores.' });
      }
};

exports.eliminarColaborador = async (req, res) => {
    try {
        const { id_proyecto, id_colaborador } = req.params; 
        const creador = await obtenerIdEstudianteDesdeToken(req);
    
        if (!creador) return res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado.' });
    
        const proyecto = await Proyecto.findById(id_proyecto);
        if (!proyecto || proyecto.id_estudiante !== creador.id_estudiante) {
          return res.status(403).json({ ok: false, mensaje: 'Solo el creador del proyecto puede eliminar colaboradores.' });
        }
    
        try {
          await db.query(`DELETE FROM proyecto_colaboradores WHERE id_proyecto = ? AND id_estudiante = ?`, [id_proyecto, id_colaborador]);
        } catch (error) {
          if (error.code !== '42P01' && error.mysqlCode !== 'ER_NO_SUCH_TABLE') throw error;
        }
        
        return res.status(200).json({ ok: true, mensaje: 'Colaborador eliminado correctamente.' });
      } catch (error) {
        console.error('Error en eliminarColaborador:', error);
        return res.status(500).json({ ok: false, mensaje: 'Error al eliminar colaborador.' });
      }
};