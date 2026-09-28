const db = require('../config/db');

class Vacante {
  static parseSkills(value) {
    if (!value) return [];
    return String(value)
      .replace(/[\[\]"']/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  static async getEstudiantesParaMatch() {
    const [rows] = await db.query(`
      SELECT 
        e.id_estudiante, 
        e.id_estudiante AS id_usuario, 
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.nombre_busqueda,
        e.carrera, 
        e.semestre, 
        e.competencias,
        COALESCE(string_agg(DISTINCT p.tecnologias, ','), '') AS tecnologias_proyectos,
        u.foto_perfil,
        ss.puntaje_total AS soft_score,
        ss.comunicacion,
        ss.trabajo_equipo,
        ss.liderazgo,
        ss.resolucion_problemas,
        ss.adaptabilidad,
        ss.profesionalismo,
        ss.fecha_realizacion AS soft_fecha
      FROM estudiantes e
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      LEFT JOIN proyectos p ON p.id_estudiante = e.id_estudiante
      LEFT JOIN LATERAL (
        SELECT *
        FROM soft_skills_resultados ss2
        WHERE ss2.id_estudiante = e.id_estudiante
        ORDER BY ss2.fecha_realizacion DESC, ss2.id_resultado DESC
        LIMIT 1
      ) ss ON true
      WHERE u.estado = 'activo'
      GROUP BY e.id_estudiante, u.id_usuario, ss.id_resultado, ss.puntaje_total, ss.comunicacion, ss.trabajo_equipo, ss.liderazgo, ss.resolucion_problemas, ss.adaptabilidad, ss.profesionalismo, ss.fecha_realizacion
      ORDER BY COALESCE(ss.puntaje_total, 0) DESC, e.semestre DESC
    `);
    return rows;
  }

  static async getPostulantesByVacante(id_vacante) {
    const [rows] = await db.query(`
      SELECT
        p.id_postulacion,
        p.estado,
        p.fecha_postulacion,
        u.id_usuario,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.nombre_busqueda,
        u.correo,
        u.telefono,
        u.foto_perfil,
        e.id_estudiante,
        e.matricula,
        e.carrera,
        e.semestre,
        e.competencias,
        ss.puntaje_total AS soft_score,
        ss.comunicacion,
        ss.trabajo_equipo,
        ss.liderazgo,
        ss.resolucion_problemas,
        ss.adaptabilidad,
        ss.profesionalismo,
        ss.fecha_realizacion AS soft_fecha
      FROM postulaciones p
      JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      LEFT JOIN LATERAL (
        SELECT *
        FROM soft_skills_resultados ss2
        WHERE ss2.id_estudiante = e.id_estudiante
        ORDER BY ss2.fecha_realizacion DESC, ss2.id_resultado DESC
        LIMIT 1
      ) ss ON true
      WHERE p.id_vacante = ?
      ORDER BY p.fecha_postulacion DESC
    `, [id_vacante]);
    return rows;
  }

  static async getMetricasDashboard(id_usuario) {
    const [rows] = await db.query(`
      SELECT
        COUNT(DISTINCT CASE WHEN v.estado = 'abierta' THEN v.id_vacante END) AS vacantes_activas,
        COUNT(DISTINCT p.id_postulacion) AS postulaciones_totales,
        COUNT(DISTINCT CASE WHEN p.estado IN ('revisada','aceptada','rechazada') THEN p.id_postulacion END) AS candidatos_revisados,
        COUNT(DISTINCT CASE WHEN p.estado = 'aceptada' THEN p.id_postulacion END) AS contrataciones
      FROM empresas emp
      LEFT JOIN vacantes v ON v.id_empresa = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      WHERE emp.id_empresa = ?
    `, [id_usuario]);

    return rows[0] || { vacantes_activas: 0, postulaciones_totales: 0, candidatos_revisados: 0, contrataciones: 0 };
  }

  static async getVacantesEmpresa(id_usuario) {
    const [rows] = await db.query(`
      SELECT
        v.*,
        COUNT(p.id_postulacion) AS total_postulaciones
      FROM vacantes v
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      WHERE v.id_empresa = ?
      GROUP BY v.id_vacante
      ORDER BY v.fecha_registro DESC
    `, [id_usuario]);
    return rows;
  }

  static async getIdEmpresaByUsuario(id_usuario) {
    const [rows] = await db.query('SELECT id_empresa, estado FROM empresas WHERE id_empresa = ? LIMIT 1', [id_usuario]);
    return rows[0] || null;
  }

  static async getPerfilEmpresa(id_usuario) {
    const [rows] = await db.query(`
      SELECT
        emp.*,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.fecha_registro
      FROM empresas emp
      JOIN usuarios u ON emp.id_empresa = u.id_usuario
      WHERE emp.id_empresa = ?
      LIMIT 1
    `, [id_usuario]);
    return rows[0] || null;
  }

  static async getEstudiantesDestacados() {
    const [rows] = await db.query(`
      SELECT 
        u.id_usuario,
        u.nombre_busqueda,
        e.id_estudiante AS id, 
        CONCAT(u.nombre, ' ', u.apellido) AS nombre, 
        e.carrera, 
        e.semestre,
        e.competencias,
        u.foto_perfil,
        ss.puntaje_total AS soft_score,
        ss.comunicacion,
        ss.trabajo_equipo,
        ss.liderazgo,
        ss.resolucion_problemas,
        ss.adaptabilidad,
        ss.profesionalismo,
        ss.fecha_realizacion AS soft_fecha
      FROM estudiantes e
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      LEFT JOIN LATERAL (
        SELECT *
        FROM soft_skills_resultados ss2
        WHERE ss2.id_estudiante = e.id_estudiante
        ORDER BY ss2.fecha_realizacion DESC, ss2.id_resultado DESC
        LIMIT 1
      ) ss ON true
      WHERE u.estado = 'activo'
      ORDER BY COALESCE(ss.puntaje_total, 0) DESC, e.id_estudiante DESC
    `);
    return rows;
  }

  static async create(data) {
    const empresa = await this.getIdEmpresaByUsuario(data.id_empresa);
    if (!empresa) throw new Error('Empresa no encontrada');
    if (empresa.estado !== 'habilitada') {
      const err = new Error('Tu empresa aún no está habilitada por Vinculación. No puedes publicar vacantes todavía.');
      err.status = 403;
      throw err;
    }

    const fields = [
      'id_empresa','titulo','categoria','nivel','descripcion','requisitos','ubicacion','modalidad',
      'tipo_oportunidad','horario','salario_min','salario_max','moneda','mostrar_salario','plazas',
      'fecha_limite','actividades','responsabilidades','requisitos_obligatorios','requisitos_deseables',
      'tecnologias_requeridas','tecnologias_deseables','habilidades_blandas','beneficios','experiencia',
      'carrera_preferida'
    ];
    const values = fields.map((field) => data[field] ?? null);
    const placeholders = fields.map(() => '?').join(', ');
    const [result] = await db.query(`
      INSERT INTO vacantes (${fields.join(', ')}, estado)
      VALUES (${placeholders}, 'abierta')
    `, values);

    return result.insertId;
  }

  static async findById(id_vacante, id_empresa = null) {
    const params = id_empresa ? [id_vacante, id_empresa] : [id_vacante];
    const where = id_empresa ? 'WHERE v.id_vacante = ? AND v.id_empresa = ?' : 'WHERE v.id_vacante = ?';

    const [rows] = await db.query(`
      SELECT
        v.*,
        emp.razon_social AS empresa,
        emp.descripcion_empresa,
        emp.ubicacion AS empresa_ubicacion,
        emp.sitio_web,
        emp.tamano_empresa,
        emp.linkedin AS empresa_linkedin,
        emp.cultura_valores,
        emp.beneficios_empresa,
        emp.proceso_seleccion,
        u.foto_perfil AS empresa_logo,
        COUNT(p.id_postulacion) AS total_postulaciones
      FROM vacantes v
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      JOIN usuarios u ON u.id_usuario = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      ${where}
      GROUP BY v.id_vacante, emp.id_empresa, u.id_usuario
      LIMIT 1
    `, params);

    return rows[0] || null;
  }

  static async findForStudent(id_vacante, id_estudiante) {
    const [rows] = await db.query(`
      SELECT
        v.*,
        emp.razon_social AS empresa,
        emp.giro,
        emp.sector,
        emp.rfc,
        emp.domicilio AS empresa_domicilio,
        emp.ubicacion AS empresa_ubicacion,
        emp.descripcion_empresa,
        emp.sitio_web,
        emp.tamano_empresa,
        emp.anio_fundacion,
        emp.linkedin AS empresa_linkedin,
        emp.cultura_valores,
        emp.beneficios_empresa,
        emp.proceso_seleccion,
        emp.estado AS empresa_estado,
        u.foto_perfil AS empresa_logo,
        p.estado AS estado_postulacion
      FROM vacantes v
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      JOIN usuarios u ON u.id_usuario = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante AND p.id_estudiante = ?
      WHERE v.id_vacante = ? AND v.estado = 'abierta' AND emp.estado = 'habilitada'
      LIMIT 1
    `, [id_estudiante, id_vacante]);
    return rows[0] || null;
  }

  static async update(id_vacante, id_empresa, data) {
    const fields = [
      'titulo','categoria','nivel','descripcion','requisitos','ubicacion','modalidad','tipo_oportunidad',
      'horario','salario_min','salario_max','moneda','mostrar_salario','plazas','fecha_limite','actividades',
      'responsabilidades','requisitos_obligatorios','requisitos_deseables','tecnologias_requeridas',
      'tecnologias_deseables','habilidades_blandas','beneficios','experiencia','carrera_preferida','estado'
    ];
    const assignments = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => data[field] ?? null);
    values.push(id_vacante, id_empresa);
    const [result] = await db.query(`
      UPDATE vacantes
      SET ${assignments}
      WHERE id_vacante = ? AND id_empresa = ?
    `, values);
    return result.affectedRows;
  }

  static async updateEstado(id_vacante, estado) {
    const [result] = await db.query(`UPDATE vacantes SET estado = ? WHERE id_vacante = ?`, [estado, id_vacante]);
    return result.affectedRows;
  }

  static async delete(id_vacante, id_empresa) {
    const [result] = await db.query(`DELETE FROM vacantes WHERE id_vacante = ? AND id_empresa = ?`, [id_vacante, id_empresa]);
    return result.affectedRows;
  }

  static async actualizarEstadoPostulacion(id_postulacion, id_empresa, estado) {
    const [result] = await db.query(`
      UPDATE postulaciones p
      SET estado = ?
      FROM vacantes v
      WHERE p.id_vacante = v.id_vacante
        AND p.id_postulacion = ?
        AND v.id_empresa = ?
    `, [estado, id_postulacion, id_empresa]);

    return result.affectedRows;
  }
}

module.exports = Vacante;
