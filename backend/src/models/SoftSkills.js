const db = require('../config/db');

class SoftSkills {
  static async getPreguntasActivas() {
    const [rows] = await db.query(`
      SELECT id_pregunta, competencia, pregunta, orden, inversa
      FROM soft_skills_preguntas
      WHERE activa = true
      ORDER BY orden ASC, id_pregunta ASC
    `);
    return rows;
  }

  static async getResultadoByEstudiante(id_estudiante) {
    const [rows] = await db.query(`
      SELECT id_resultado, id_estudiante, puntaje_total, comunicacion, trabajo_equipo,
             liderazgo, resolucion_problemas, adaptabilidad, profesionalismo,
             respuestas, fecha_realizacion
      FROM soft_skills_resultados
      WHERE id_estudiante = ?
      ORDER BY fecha_realizacion DESC, id_resultado DESC
      LIMIT 1
    `, [id_estudiante]);
    return rows[0] || null;
  }

  static calcularResultados(preguntas = [], respuestas = []) {
    const byId = new Map(preguntas.map((p) => [Number(p.id_pregunta), p]));
    const grupos = {};
    const respuestasNormalizadas = [];

    respuestas.forEach((item) => {
      const idPregunta = Number(item.id_pregunta);
      const valor = Number(item.valor);
      const pregunta = byId.get(idPregunta);
      if (!pregunta) return;
      if (!Number.isFinite(valor) || valor < 1 || valor > 5) return;

      const competencia = pregunta.competencia;
      const valorCalculado = pregunta.inversa ? (6 - valor) : valor;
      if (!grupos[competencia]) grupos[competencia] = [];
      grupos[competencia].push(valorCalculado);
      respuestasNormalizadas.push({
        id_pregunta: idPregunta,
        competencia,
        valor,
        inversa: Boolean(pregunta.inversa),
        valor_calculado: valorCalculado,
      });
    });

    const competencias = ['comunicacion', 'trabajo_equipo', 'liderazgo', 'resolucion_problemas', 'adaptabilidad', 'profesionalismo'];
    const resultados = {};
    const valoresGlobales = [];

    competencias.forEach((competencia) => {
      const valores = grupos[competencia] || [];
      valoresGlobales.push(...valores);
      const promedio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
      resultados[competencia] = Math.round((promedio / 5) * 100);
    });

    const promedioGlobal = valoresGlobales.length
      ? valoresGlobales.reduce((a, b) => a + b, 0) / valoresGlobales.length
      : 0;

    return {
      ...resultados,
      puntaje_total: Math.round((promedioGlobal / 5) * 100),
      respuestas: respuestasNormalizadas,
      total_respondidas: respuestasNormalizadas.length,
      total_preguntas: preguntas.length,
    };
  }

  static async guardarResultado(id_estudiante, resultado) {
    const [insert] = await db.query(`
      INSERT INTO soft_skills_resultados (
        id_estudiante, puntaje_total, comunicacion, trabajo_equipo, liderazgo,
        resolucion_problemas, adaptabilidad, profesionalismo, respuestas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id_estudiante,
      resultado.puntaje_total,
      resultado.comunicacion,
      resultado.trabajo_equipo,
      resultado.liderazgo,
      resultado.resolucion_problemas,
      resultado.adaptabilidad,
      resultado.profesionalismo,
      JSON.stringify(resultado.respuestas),
    ]);

    return this.getResultadoByEstudiante(id_estudiante) || { id_resultado: insert.insertId, ...resultado };
  }
}

module.exports = SoftSkills;
