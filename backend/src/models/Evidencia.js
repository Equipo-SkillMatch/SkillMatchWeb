const db = require('../config/db');

class Evidencia {
  static async create({
    id_proyecto,
    ruta_archivo,
    tipo = null,
    nombre_original = null,
    mime_type = null,
    tamano_bytes = null,
    hash_archivo = null,
  }) {
    const [result] = await db.query(
      `INSERT INTO evidencias (
        id_proyecto,
        ruta_archivo,
        tipo,
        nombre_original,
        mime_type,
        tamano_bytes,
        hash_archivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id_proyecto,
        ruta_archivo,
        tipo,
        nombre_original,
        mime_type,
        tamano_bytes,
        hash_archivo,
      ]
    );

    return result.insertId;
  }

  static async findById(id_evidencia) {
    const [rows] = await db.query(
      `SELECT * FROM evidencias WHERE id_evidencia = ? LIMIT 1`,
      [id_evidencia]
    );
    return rows[0];
  }

  static async findAllByEstudiante(id_estudiante) {
    const [rows] = await db.query(
      `SELECT
        e.id_evidencia,
        e.id_proyecto,
        e.ruta_archivo,
        e.tipo,
        e.nombre_original,
        e.mime_type,
        e.tamano_bytes,
        e.hash_archivo,
        e.fecha_subida,
        p.titulo AS proyecto_titulo,
        p.estado AS proyecto_estado
      FROM evidencias e
      INNER JOIN proyectos p ON e.id_proyecto = p.id_proyecto
      WHERE p.id_estudiante = ?
      ORDER BY e.fecha_subida DESC, e.id_evidencia DESC`,
      [id_estudiante]
    );

    return rows;
  }

  static async findByIdAndEstudiante(id_evidencia, id_estudiante) {
    const [rows] = await db.query(
      `SELECT
        e.*,
        p.id_estudiante,
        p.titulo AS proyecto_titulo
      FROM evidencias e
      INNER JOIN proyectos p ON e.id_proyecto = p.id_proyecto
      WHERE e.id_evidencia = ? AND p.id_estudiante = ?
      LIMIT 1`,
      [id_evidencia, id_estudiante]
    );

    return rows[0];
  }

  static async findByProyecto(id_proyecto) {
    const [rows] = await db.query(
      `SELECT *
       FROM evidencias
       WHERE id_proyecto = ?
       ORDER BY fecha_subida DESC, id_evidencia DESC`,
      [id_proyecto]
    );
    return rows;
  }

  static async delete(id_evidencia) {
    const [result] = await db.query(
      `DELETE FROM evidencias WHERE id_evidencia = ?`,
      [id_evidencia]
    );

    return result.affectedRows;
  }

  static async countByEstudiante(id_estudiante) {
    const [rows] = await db.query(
      `SELECT COUNT(e.id_evidencia) AS total
       FROM evidencias e
       INNER JOIN proyectos p ON e.id_proyecto = p.id_proyecto
       WHERE p.id_estudiante = ?`,
      [id_estudiante]
    );

    return rows[0]?.total || 0;
  }
}

module.exports = Evidencia;
