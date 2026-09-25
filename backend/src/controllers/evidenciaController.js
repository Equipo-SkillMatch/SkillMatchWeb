const fs = require('fs');
const path = require('path');
const Estudiante = require('../models/Estudiante');
const Proyecto = require('../models/Proyecto');
const Evidencia = require('../models/Evidencia');


function tipoArchivo(mime = '', original = '') {
  const value = String(mime || '').toLowerCase();
  const name = String(original || '').toLowerCase();
  if (value.startsWith('image/')) return 'imagen';
  if (value.startsWith('video/')) return 'video';
  if (value === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'documento';
}


const obtenerEstudianteDesdeToken = async (req) => {
  const id_usuario = req.usuario.id_usuario;
  return await Estudiante.findByUsuarioId(id_usuario);
};

exports.listarMisEvidencias = async (req, res) => {
  try {
    const estudiante = await obtenerEstudianteDesdeToken(req);

    if (!estudiante) {
      return res.status(404).json({
        ok: false,
        mensaje: 'No se encontró el perfil del estudiante'
      });
    }

    const evidencias = await Evidencia.findAllByEstudiante(estudiante.id_estudiante);

    return res.status(200).json({
      ok: true,
      evidencias
    });
  } catch (error) {
    console.error('Error en listarMisEvidencias:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor'
    });
  }
};

exports.subirEvidencia = async (req, res) => {
  try {
    const { id_proyecto, tipo } = req.body;
    const archivo = req.file;

    if (!archivo) return res.status(400).json({ ok: false, mensaje: 'Debes seleccionar un archivo' });
    if (!id_proyecto) return res.status(400).json({ ok: false, mensaje: 'Debes indicar el proyecto' });

    const estudiante = await obtenerEstudianteDesdeToken(req);
    if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'No se encontró el perfil del estudiante' });

    const proyecto = await Proyecto.findByIdAndEstudiante(id_proyecto, estudiante.id_estudiante);
    if (!proyecto) return res.status(403).json({ ok: false, mensaje: 'Ese proyecto no te pertenece o no existe' });

    // CAMBIO AQUÍ: Guardamos la URL de Cloudinary Y el Hash del archivo generado en memoria
    const id_evidencia = await Evidencia.create({
      id_proyecto,
      ruta_archivo: archivo.path, // <--- URL completa de la nube
      tipo: tipo || tipoArchivo(archivo.mimetype, archivo.originalname),
      nombre_original: archivo.originalname,
      mime_type: archivo.mimetype,
      tamano_bytes: archivo.size,
      hash_archivo: archivo.hash_archivo // --- AQUÍ ATRAPAMOS EL HASH (SHA-256) PARA LA AUDITORÍA
    });

    const evidencia = await Evidencia.findById(id_evidencia);
    return res.status(201).json({ ok: true, mensaje: 'Evidencia subida correctamente', evidencia });
  } catch (error) {
    console.error('Error en subirEvidencia:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};

exports.eliminarEvidencia = async (req, res) => {
  try {
    const { id } = req.params;
    const estudiante = await obtenerEstudianteDesdeToken(req);

    if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'No se encontró el perfil del estudiante' });

    const evidencia = await Evidencia.findByIdAndEstudiante(id, estudiante.id_estudiante);
    if (!evidencia) return res.status(404).json({ ok: false, mensaje: 'Evidencia no encontrada' });

    // Eliminamos la lógica de fs.unlinkSync porque el archivo está en la nube
    await Evidencia.delete(id);

    return res.status(200).json({ ok: true, mensaje: 'Evidencia eliminada correctamente' });
  } catch (error) {
    console.error('Error en eliminarEvidencia:', error);
    return res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
};