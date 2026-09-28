const Vacante = require('../models/Vacante');
const { coincideNombreBusqueda, normalizarTexto } = require('../utils/nameUtils');

function parseHabilidades(value) {
  if (!value) return ['Sin definir'];
  const arr = String(value)
    .replace(/[\[\]"']/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? [...new Set(arr)] : ['Sin definir'];
}

function mapSoftSkills(est) {
  const puntaje = est.soft_score === null || est.soft_score === undefined ? null : Number(est.soft_score);
  return {
    puntaje_total: puntaje,
    comunicacion: est.comunicacion === null || est.comunicacion === undefined ? null : Number(est.comunicacion),
    trabajo_equipo: est.trabajo_equipo === null || est.trabajo_equipo === undefined ? null : Number(est.trabajo_equipo),
    liderazgo: est.liderazgo === null || est.liderazgo === undefined ? null : Number(est.liderazgo),
    resolucion_problemas: est.resolucion_problemas === null || est.resolucion_problemas === undefined ? null : Number(est.resolucion_problemas),
    adaptabilidad: est.adaptabilidad === null || est.adaptabilidad === undefined ? null : Number(est.adaptabilidad),
    profesionalismo: est.profesionalismo === null || est.profesionalismo === undefined ? null : Number(est.profesionalismo),
    fecha_realizacion: est.soft_fecha || null,
    completado: puntaje !== null,
  };
}

function mapEstudiante(est) {
  const habilidades = [...new Set([
    ...parseHabilidades(est.competencias),
    ...parseHabilidades(est.tecnologias_proyectos)
  ].filter((h) => h !== 'Sin definir'))];

  return {
    id_usuario: est.id_usuario,
    id_estudiante: est.id_estudiante || est.id,
    nombre: est.nombre,
    nombre_busqueda: est.nombre_busqueda || normalizarTexto(est.nombre),
    carrera: est.carrera || 'Sin especificar',
    habilidades: habilidades.length ? habilidades : ['Sin definir'],
    foto_perfil: est.foto_perfil,
    validado: true,
    habilidades_blandas: mapSoftSkills(est),
    disponible: Number(est.semestre || 0) >= 8 ? 'Disponible' : 'Próximamente'
  };
}


function normalizarSkill(value) {
  return normalizarTexto(String(value || '').replace(/\./g, ' ')).trim();
}

function calcularMatch(estudiante, skillsSolicitadas = []) {
  const requeridas = [...new Set(skillsSolicitadas.map(normalizarSkill).filter(Boolean))];
  const disponibles = (estudiante.habilidades || []).map((h) => ({ original: h, normal: normalizarSkill(h) }));
  const coincidencias = requeridas.filter((req) => disponibles.some((h) => h.normal.includes(req) || req.includes(h.normal)));
  const faltantes = requeridas.filter((req) => !coincidencias.includes(req));

  // Score explicable. Tecnologias pesan 75% y soft skills 25% cuando existe evaluacion.
  const techScore = requeridas.length ? Math.round((coincidencias.length / requeridas.length) * 100) : 100;
  const softScore = estudiante.habilidades_blandas?.completado ? Number(estudiante.habilidades_blandas.puntaje_total || 0) : null;
  const score = softScore === null
    ? techScore
    : Math.round((techScore * 0.75) + (softScore * 0.25));

  return {
    ...estudiante,
    match_score: Math.max(0, Math.min(100, score)),
    match_detalle: {
      tecnologias: techScore,
      habilidades_blandas: softScore,
      coincidencias,
      faltantes,
      total_requeridas: requeridas.length,
    },
  };
}


function normalizarListaCampo(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(',');
  if (!value) return null;
  return String(value).split(',').map((v) => v.trim()).filter(Boolean).join(',');
}

function normalizarVacantePayload(body = {}) {
  const numero = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
  return {
    titulo: String(body.titulo || '').trim(),
    categoria: body.categoria || null,
    nivel: body.nivel || null,
    descripcion: body.descripcion || null,
    requisitos: body.requisitos || body.requisitos_obligatorios || null,
    ubicacion: body.ubicacion || null,
    modalidad: body.modalidad || null,
    tipo_oportunidad: body.tipo_oportunidad || null,
    horario: body.horario || null,
    salario_min: numero(body.salario_min),
    salario_max: numero(body.salario_max),
    moneda: body.moneda || 'MXN',
    mostrar_salario: body.mostrar_salario === true || body.mostrar_salario === 'true',
    plazas: Math.max(1, numero(body.plazas) || 1),
    fecha_limite: body.fecha_limite || null,
    actividades: body.actividades || null,
    responsabilidades: body.responsabilidades || null,
    requisitos_obligatorios: body.requisitos_obligatorios || body.requisitos || null,
    requisitos_deseables: body.requisitos_deseables || null,
    tecnologias_requeridas: normalizarListaCampo(body.tecnologias_requeridas),
    tecnologias_deseables: normalizarListaCampo(body.tecnologias_deseables),
    habilidades_blandas: normalizarListaCampo(body.habilidades_blandas),
    beneficios: body.beneficios || null,
    experiencia: body.experiencia || null,
    carrera_preferida: body.carrera_preferida || null,
    estado: body.estado || 'abierta',
  };
}

function filtrarPorNombre(estudiantes, nombreBuscado) {
  if (!nombreBuscado || !String(nombreBuscado).trim()) return estudiantes;
  return estudiantes.filter((e) => coincideNombreBusqueda(e.nombre_busqueda || e.nombre, nombreBuscado));
}

exports.realizarMatchEstudiantes = async (req, res) => {
  try {
    const nombre = req.query.nombre || req.query.busqueda || '';
    const skills = String(req.query.skills || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const estudiantesDB = await Vacante.getEstudiantesParaMatch();
    const estudiantesMatch = filtrarPorNombre(estudiantesDB.map(mapEstudiante), nombre)
      .map((est) => calcularMatch(est, skills))
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    res.status(200).json({ ok: true, estudiantes: estudiantesMatch, criterios: skills });
  } catch (error) {
    console.error('Error en realizarMatchEstudiantes:', error);
    res.status(500).json({ ok: false, mensaje: 'Error al generar el Match' });
  }
};

exports.obtenerPerfilEmpresa = async (req, res) => {
  try {
    const empresa = await Vacante.getPerfilEmpresa(req.usuario.id_usuario);
    if (!empresa) return res.status(404).json({ ok: false, mensaje: 'Perfil de empresa no encontrado' });
    return res.json({ ok: true, empresa });
  } catch (error) {
    console.error('Error al obtener perfil empresa:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar perfil de empresa' });
  }
};

exports.aceptarPostulante = async (req, res) => {
  try {
    const affected = await Vacante.actualizarEstadoPostulacion(req.params.id_postulacion, req.usuario.id_usuario, 'aceptada');
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada' });
    return res.json({ ok: true, mensaje: 'Postulante aceptado correctamente' });
  } catch (error) {
    console.error('Error al aceptar postulante:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al aceptar postulante' });
  }
};

exports.rechazarPostulante = async (req, res) => {
  try {
    const affected = await Vacante.actualizarEstadoPostulacion(req.params.id_postulacion, req.usuario.id_usuario, 'rechazada');
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Postulación no encontrada' });
    return res.json({ ok: true, mensaje: 'Postulante rechazado correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al rechazar postulante' });
  }
};

exports.getDashboardCompleto = async (req, res) => {
  try {
    const id_usuario_empresa = req.usuario.id_usuario;
    const [metricas, vacantes, estudiantesDB, empresa] = await Promise.all([
      Vacante.getMetricasDashboard(id_usuario_empresa),
      Vacante.getVacantesEmpresa(id_usuario_empresa),
      Vacante.getEstudiantesDestacados(),
      Vacante.getPerfilEmpresa(id_usuario_empresa)
    ]);

    const estudiantes = estudiantesDB.map((est) => ({
      ...mapEstudiante(est),
      habilidades: parseHabilidades(est.competencias)
    }));

    return res.status(200).json({
      ok: true,
      data: {
        empresa,
        metricas: {
          activas: Number(metricas.vacantes_activas || 0),
          postulaciones: Number(metricas.postulaciones_totales || 0),
          revisados: Number(metricas.candidatos_revisados || 0),
          contrataciones: Number(metricas.contrataciones || 0)
        },
        vacantes,
        estudiantes
      }
    });
  } catch (error) {
    console.error('Error en getDashboardCompleto:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.crearVacante = async (req, res) => {
  try {
    const payload = normalizarVacantePayload(req.body);
    if (!payload.titulo || !payload.descripcion) return res.status(400).json({ ok: false, mensaje: 'Título y descripción son obligatorios' });
    if (!payload.tecnologias_requeridas) return res.status(400).json({ ok: false, mensaje: 'Selecciona al menos una tecnología requerida.' });
    if (payload.salario_min !== null && payload.salario_max !== null && payload.salario_min > payload.salario_max) {
      return res.status(400).json({ ok: false, mensaje: 'El salario mínimo no puede ser mayor al salario máximo.' });
    }

    const id_vacante = await Vacante.create({ id_empresa: req.usuario.id_usuario, ...payload });
    const vacante = await Vacante.findById(id_vacante, req.usuario.id_usuario);
    return res.status(201).json({ ok: true, mensaje: 'Vacante publicada correctamente', vacante });
  } catch (error) {
    console.error('Error al crear vacante:', error);
    return res.status(error.status || 500).json({ ok: false, mensaje: error.message || 'Error al crear vacante' });
  }
};

exports.obtenerVacante = async (req, res) => {
  try {
    const vacante = await Vacante.findById(req.params.id, req.usuario.id_usuario);
    if (!vacante) return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada' });
    const postulantes = (await Vacante.getPostulantesByVacante(req.params.id)).map((p) => ({
      ...p,
      habilidades_blandas: mapSoftSkills(p),
    }));
    return res.json({ ok: true, vacante, postulantes });
  } catch (error) {
    console.error('Error al cargar vacante:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al cargar vacante' });
  }
};

exports.actualizarVacante = async (req, res) => {
  try {
    const payload = normalizarVacantePayload(req.body);
    if (!payload.titulo || !payload.descripcion) return res.status(400).json({ ok: false, mensaje: 'Título y descripción son obligatorios' });
    if (!['abierta', 'pausada', 'cerrada'].includes(payload.estado)) return res.status(400).json({ ok: false, mensaje: 'Estado inválido' });
    if (!payload.tecnologias_requeridas) return res.status(400).json({ ok: false, mensaje: 'Selecciona al menos una tecnología requerida.' });

    const affected = await Vacante.update(req.params.id, req.usuario.id_usuario, payload);
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada' });
    const vacante = await Vacante.findById(req.params.id, req.usuario.id_usuario);
    return res.json({ ok: true, mensaje: 'Vacante actualizada correctamente', vacante });
  } catch (error) {
    console.error('Error al actualizar vacante:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar vacante' });
  }
};

exports.eliminarVacante = async (req, res) => {
  try {
    const affected = await Vacante.delete(req.params.id, req.usuario.id_usuario);
    if (!affected) return res.status(404).json({ ok: false, mensaje: 'Vacante no encontrada' });
    return res.json({ ok: true, mensaje: 'Vacante eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ ok: false, mensaje: 'Error al eliminar vacante' });
  }
};
