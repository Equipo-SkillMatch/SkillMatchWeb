const Proyecto = require('../models/Proyecto');
const db = require('../config/db');
const { isSameAsset } = require('../utils/fileUrl');

const APP_VERSION = '3.1.0-media-profile';

function inferMimeType(item = {}) {
  if (item.mime_type) return String(item.mime_type);
  const source = String(item.ruta_archivo || item.nombre_original || '').split('?')[0].toLowerCase();
  if (/\.(jpe?g)$/.test(source)) return 'image/jpeg';
  if (/\.png$/.test(source)) return 'image/png';
  if (/\.webp$/.test(source)) return 'image/webp';
  if (/\.mp4$/.test(source)) return 'video/mp4';
  if (/\.webm$/.test(source)) return 'video/webm';
  if (/\.mov$/.test(source)) return 'video/quicktime';
  if (/\.pdf$/.test(source)) return 'application/pdf';
  return '';
}

function normalizeEvidence(item = {}) {
  const mime_type = inferMimeType(item);
  const cleanPath = String(item.ruta_archivo || '').split('?')[0];
  const basename = cleanPath.split('/').pop() || 'Archivo del proyecto';
  return {
    ...item,
    mime_type,
    nombre_original: item.nombre_original || basename,
    categoria_archivo: mime_type.startsWith('image/')
      ? 'imagen'
      : mime_type.startsWith('video/')
        ? 'video'
        : mime_type === 'application/pdf'
          ? 'documento'
          : 'archivo',
  };
}


function limpiarGaleria(media = [], portada = null) {
  return (Array.isArray(media) ? media : []).filter((item) => {
    const ruta = item?.ruta_archivo;
    return ruta && !isSameAsset(ruta, portada);
  });
}

exports.listarProyectosPublicos = async (req, res) => {
  try {
    const proyectos = await Proyecto.findPublicProjects();

    const proyectosFormateados = proyectos.map((p, index) => {
      // Compatibilidad con proyectos antiguos: si no hay portada explícita, usa la primera imagen.
      const portada = p.img_principal || p.media?.find((m) => m.tipo === 'imagen')?.ruta_archivo || null;
      return {
        id_proyecto: p.id_proyecto,
        title: p.titulo,
        titulo: p.titulo,
        desc: p.descripcion || 'Proyecto académico publicado en SkillMatch.',
        descripcion: p.descripcion,
        author: `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Comunidad UTEQ',
        nombre: p.nombre,
        apellido: p.apellido,
        foto_creador: p.foto_creador,
        tipo_creador: p.tipo_creador,
        carrera: p.carrera || 'UTEQ',
        estado: p.estado,
        fecha_registro: p.fecha_registro,
        img_principal: portada,
        media: limpiarGaleria(p.media, portada),
        tecnologias: p.tecnologias || '',
        tags: p.tecnologias ? String(p.tecnologias).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4) : (p.carrera ? [p.carrera] : ['Proyecto UTEQ']),
        rating: parseFloat(p.promedio_estrellas || 0),
        total_reviews: Number(p.total_calificaciones || 0),
        thumb: (index % 3) + 1,
      };
    });

    return res.status(200).json({ ok: true, proyectos: proyectosFormateados });
  } catch (error) {
    console.error('Error en listarProyectosPublicos:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.obtenerDetalleProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const [proyectos] = await db.query(
      `SELECT p.*,
              COALESCE(ue.nombre, up.nombre) AS nombre,
              COALESCE(ue.apellido, up.apellido) AS apellido,
              COALESCE(ue.foto_perfil, up.foto_perfil) AS foto_creador,
              COALESCE(e.carrera, pr.departamento, 'UTEQ') AS carrera,
              CASE WHEN p.id_profesor IS NOT NULL THEN 'Profesor' ELSE 'Estudiante' END AS tipo_creador,
              COALESCE(AVG(c.puntaje), 0) as promedio_estrellas,
              COUNT(c.id_calificacion) as total_calificaciones
       FROM proyectos p
       LEFT JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
       LEFT JOIN usuarios ue ON e.id_estudiante = ue.id_usuario
       LEFT JOIN profesores pr ON p.id_profesor = pr.id_profesor
       LEFT JOIN usuarios up ON pr.id_profesor = up.id_usuario
       LEFT JOIN calificaciones c ON p.id_proyecto = c.id_proyecto
       WHERE p.id_proyecto = ?
       GROUP BY p.id_proyecto, ue.nombre, ue.apellido, ue.foto_perfil, up.nombre, up.apellido, up.foto_perfil, e.carrera, pr.departamento`,
      [id]
    );

    if (proyectos.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Proyecto no encontrado' });
    }

    const p = proyectos[0];
    const mediaOriginal = await Proyecto.getMedia(id);
    const portada = p.img_principal || mediaOriginal.find((m) => m.tipo === 'imagen')?.ruta_archivo || null;
    const media = limpiarGaleria(mediaOriginal, portada);

    const proyectoFormateado = {
      ...p,
      title: p.titulo,
      desc: p.descripcion,
      author: `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Comunidad UTEQ',
      rating: parseFloat(p.promedio_estrellas || 0),
      total_reviews: Number(p.total_calificaciones || 0),
      tags: p.tecnologias ? String(p.tecnologias).split(',').map((t) => t.trim()).filter(Boolean) : (p.carrera ? [p.carrera] : []),
      media,
      img_principal: portada,
    };

    const [evidenciasRows] = await db.query(
      `SELECT * FROM evidencias WHERE id_proyecto = ? ORDER BY fecha_subida DESC, id_evidencia DESC`,
      [id]
    );
    const evidencias = evidenciasRows.map(normalizeEvidence);

    const [colaboradores] = await db.query(
      `SELECT u.nombre, u.apellido, u.correo, e.matricula, e.carrera
       FROM proyecto_colaboradores pc
       JOIN estudiantes e ON pc.id_estudiante = e.id_estudiante
       JOIN usuarios u ON e.id_estudiante = u.id_usuario
       WHERE pc.id_proyecto = ?
       ORDER BY u.nombre ASC`,
      [id]
    ).catch(() => [[]]);

    const [comentarios] = await db.query(
      `SELECT c.puntaje, c.comentario, c.fecha, u.nombre, u.apellido
       FROM calificaciones c
       INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_proyecto = ?
       ORDER BY c.fecha DESC`,
      [id]
    );

    return res.status(200).json({
      ok: true,
      proyecto: proyectoFormateado,
      media,
      evidencias,
      colaboradores,
      comentarios
    });
  } catch (error) {
    console.error('Error al obtener detalle del proyecto:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.calificarProyecto = async (req, res) => {
  try {
    const { id_proyecto } = req.params;
    const { estrellas, comentario } = req.body;
    const id_usuario = req.usuario.id_usuario;

    if (!estrellas || estrellas < 1 || estrellas > 5) {
      return res.status(400).json({ ok: false, mensaje: 'La calificación debe ser entre 1 y 5 estrellas.' });
    }

    const [existente] = await db.query(
      'SELECT id_calificacion FROM calificaciones WHERE id_proyecto = ? AND id_usuario = ? LIMIT 1',
      [id_proyecto, id_usuario]
    );

    if (existente.length > 0) {
      await db.query(
        'UPDATE calificaciones SET puntaje = ?, comentario = ?, fecha = CURRENT_TIMESTAMP WHERE id_calificacion = ?',
        [estrellas, comentario || null, existente[0].id_calificacion]
      );
    } else {
      await db.query(
        'INSERT INTO calificaciones (id_proyecto, id_usuario, puntaje, comentario) VALUES (?, ?, ?, ?)',
        [id_proyecto, id_usuario, estrellas, comentario || null]
      );
    }

    return res.status(200).json({ ok: true, mensaje: '¡Gracias por tu calificación!' });
  } catch (error) {
    console.error('Error al calificar proyecto:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno al guardar la calificación.' });
  }
};

exports.obtenerVersion = (_req, res) => res.json({
  ok: true,
  version: APP_VERSION,
  storage: process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET ? 'cloudinary' : 'local',
});
