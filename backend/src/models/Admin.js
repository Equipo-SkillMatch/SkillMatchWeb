const db = require('../config/db');
const Proyecto = require('./Proyecto');

class Admin {
  static async getGlobalStats() {
    const [empresas] = await db.query('SELECT COUNT(*) as total FROM empresas');
    const [empresasPendientes] = await db.query("SELECT COUNT(*) as total FROM empresas WHERE estado = 'pendiente'");
    const [estudiantes] = await db.query('SELECT COUNT(*) as total FROM estudiantes');
    const [profesores] = await db.query('SELECT COUNT(*) as total FROM profesores');
    const [proyectos] = await db.query('SELECT COUNT(*) as total FROM proyectos');
    const [vacantes] = await db.query("SELECT COUNT(*) as total FROM vacantes WHERE estado = 'abierta'");
    const [postulaciones] = await db.query('SELECT COUNT(*) as total FROM postulaciones');

    return {
      totalEmpresas: Number(empresas[0]?.total || 0),
      empresasPendientes: Number(empresasPendientes[0]?.total || 0),
      totalEstudiantes: Number(estudiantes[0]?.total || 0),
      totalProfesores: Number(profesores[0]?.total || 0),
      totalProyectos: Number(proyectos[0]?.total || 0),
      vacantesActivas: Number(vacantes[0]?.total || 0),
      postulacionesTotales: Number(postulaciones[0]?.total || 0),
    };
  }

  static async getVinculacionStats() {
    const [rows] = await db.query(`
      SELECT
        COUNT(DISTINCT emp.id_empresa) AS total_empresas,
        COUNT(DISTINCT CASE WHEN emp.estado = 'pendiente' THEN emp.id_empresa END) AS empresas_pendientes,
        COUNT(DISTINCT CASE WHEN emp.estado = 'habilitada' THEN emp.id_empresa END) AS empresas_habilitadas,
        COUNT(DISTINCT CASE WHEN emp.estado = 'rechazada' THEN emp.id_empresa END) AS empresas_rechazadas,
        COUNT(DISTINCT CASE WHEN v.estado = 'abierta' THEN v.id_vacante END) AS vacantes_activas,
        COUNT(DISTINCT v.id_vacante) AS total_vacantes,
        COUNT(DISTINCT p.id_postulacion) AS postulaciones_totales,
        COUNT(DISTINCT CASE WHEN p.estado = 'aceptada' THEN p.id_postulacion END) AS postulaciones_aceptadas
      FROM empresas emp
      LEFT JOIN vacantes v ON v.id_empresa = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
    `);

    const r = rows[0] || {};
    return {
      totalEmpresas: Number(r.total_empresas || 0),
      empresasPendientes: Number(r.empresas_pendientes || 0),
      empresasHabilitadas: Number(r.empresas_habilitadas || 0),
      empresasRechazadas: Number(r.empresas_rechazadas || 0),
      vacantesActivas: Number(r.vacantes_activas || 0),
      totalVacantes: Number(r.total_vacantes || 0),
      postulacionesTotales: Number(r.postulaciones_totales || 0),
      postulacionesAceptadas: Number(r.postulaciones_aceptadas || 0),
    };
  }

  static async getAllEmpresas() {
    const [rows] = await db.query(`
      SELECT
        emp.id_empresa AS id,
        emp.id_empresa,
        emp.razon_social AS nombre,
        emp.razon_social,
        emp.rfc,
        emp.domicilio,
        emp.ubicacion,
        emp.giro,
        emp.sector,
        emp.contacto,
        emp.responsable_nombre,
        emp.responsable_apellido,
        emp.responsable_cargo,
        emp.responsable_correo,
        emp.responsable_telefono,
        emp.observaciones,
        emp.estado,
        u.nombre AS usuario_nombre,
        u.apellido AS usuario_apellido,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        COUNT(DISTINCT v.id_vacante) AS total_vacantes,
        COUNT(DISTINCT p.id_postulacion) AS total_postulaciones
      FROM empresas emp
      JOIN usuarios u ON emp.id_empresa = u.id_usuario
      LEFT JOIN vacantes v ON v.id_empresa = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      GROUP BY emp.id_empresa, u.id_usuario
      ORDER BY
        CASE emp.estado
          WHEN 'pendiente' THEN 1
          WHEN 'habilitada' THEN 2
          WHEN 'deshabilitada' THEN 3
          WHEN 'rechazada' THEN 4
          ELSE 5
        END,
        emp.razon_social ASC
    `);
    return rows;
  }

  static async getEmpresaDetalle(id_empresa) {
    const [empresaRows] = await db.query(`
      SELECT
        emp.*,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        u.fecha_registro
      FROM empresas emp
      JOIN usuarios u ON emp.id_empresa = u.id_usuario
      WHERE emp.id_empresa = ?
      LIMIT 1
    `, [id_empresa]);

    if (!empresaRows.length) return null;

    const [vacantes] = await db.query(`
      SELECT
        v.*,
        COUNT(p.id_postulacion) AS total_postulaciones
      FROM vacantes v
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      WHERE v.id_empresa = ?
      GROUP BY v.id_vacante
      ORDER BY v.fecha_registro DESC
    `, [id_empresa]);

    const [postulaciones] = await db.query(`
      SELECT p.id_postulacion, p.estado, p.fecha_postulacion, v.titulo AS vacante,
             u.nombre, u.apellido, u.correo, e.carrera, e.semestre
      FROM postulaciones p
      JOIN vacantes v ON p.id_vacante = v.id_vacante
      JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      WHERE v.id_empresa = ?
      ORDER BY p.fecha_postulacion DESC
    `, [id_empresa]);

    return { ...empresaRows[0], vacantes, postulaciones };
  }

  static async updateEmpresa(id_empresa, data) {
    const {
      razon_social, rfc, domicilio, ubicacion, giro, sector, contacto,
      responsable_nombre, responsable_apellido, responsable_cargo, responsable_correo,
      responsable_telefono, observaciones, nombre, apellido, correo, telefono, estado
    } = data;

    await db.query(`
      UPDATE empresas
      SET razon_social = COALESCE(?, razon_social),
          rfc = COALESCE(?, rfc),
          domicilio = COALESCE(?, domicilio),
          ubicacion = COALESCE(?, ubicacion),
          giro = COALESCE(?, giro),
          sector = COALESCE(?, sector),
          contacto = COALESCE(?, contacto),
          responsable_nombre = COALESCE(?, responsable_nombre),
          responsable_apellido = COALESCE(?, responsable_apellido),
          responsable_cargo = COALESCE(?, responsable_cargo),
          responsable_correo = COALESCE(?, responsable_correo),
          responsable_telefono = COALESCE(?, responsable_telefono),
          observaciones = COALESCE(?, observaciones),
          estado = COALESCE(?, estado)
      WHERE id_empresa = ?
    `, [
      razon_social || null, rfc || null, domicilio || null, ubicacion || null, giro || null, sector || null, contacto || null,
      responsable_nombre || null, responsable_apellido || null, responsable_cargo || null, responsable_correo || null,
      responsable_telefono || null, observaciones || null, estado || null, id_empresa
    ]);

    await db.query(`
      UPDATE usuarios
      SET nombre = COALESCE(?, nombre),
          apellido = COALESCE(?, apellido),
          correo = COALESCE(?, correo),
          telefono = COALESCE(?, telefono)
      WHERE id_usuario = ?
    `, [nombre || null, apellido || null, correo || null, telefono || null, id_empresa]);
  }

  static async getAllAlumnos() {
    const [rows] = await db.query(`
      SELECT
        e.id_estudiante AS id,
        e.id_estudiante,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        e.carrera,
        e.matricula,
        e.semestre,
        e.estado_academico,
        e.titulo_profesional,
        e.biografia,
        e.linkedin,
        e.github,
        e.portafolio,
        e.idiomas,
        e.disponibilidad,
        e.modalidad_preferida,
        e.ciudad,
        ss.puntaje_total AS soft_score,
        ss.fecha_realizacion AS soft_fecha,
        COUNT(DISTINCT p.id_proyecto) AS total_proyectos,
        COUNT(DISTINCT po.id_postulacion) AS total_postulaciones
      FROM estudiantes e
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      LEFT JOIN proyectos p ON p.id_estudiante = e.id_estudiante
      LEFT JOIN postulaciones po ON po.id_estudiante = e.id_estudiante
      LEFT JOIN LATERAL (
        SELECT *
        FROM soft_skills_resultados ss2
        WHERE ss2.id_estudiante = e.id_estudiante
        ORDER BY ss2.fecha_realizacion DESC, ss2.id_resultado DESC
        LIMIT 1
      ) ss ON true
      GROUP BY e.id_estudiante, u.id_usuario, ss.id_resultado, ss.puntaje_total, ss.fecha_realizacion
      ORDER BY u.nombre ASC
    `);
    return rows;
  }

  static async getAlumnoDetalle(id_estudiante) {
    const [alumnoRows] = await db.query(`
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        u.fecha_registro,
        e.id_estudiante,
        e.matricula,
        e.carrera,
        e.semestre,
        e.competencias,
        e.cuatrimestre_inicial,
        e.fecha_inicio_carrera,
        e.estado_academico,
        e.titulo_profesional,
        e.biografia,
        e.linkedin,
        e.github,
        e.portafolio,
        e.idiomas,
        e.disponibilidad,
        e.modalidad_preferida,
        e.ciudad,
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
      WHERE e.id_estudiante = ?
      LIMIT 1
    `, [id_estudiante]);

    if (!alumnoRows.length) return null;

    const [proyectosRaw] = await db.query(`
      SELECT id_proyecto, titulo, descripcion, estado, fecha_registro, img_principal, tecnologias, objetivo, actividades, ambito_desarrollo, area_trabajo
      FROM proyectos
      WHERE id_estudiante = ?
      ORDER BY fecha_registro DESC
    `, [id_estudiante]);
    const proyectos = await Proyecto.attachMedia(proyectosRaw);

    const [postulaciones] = await db.query(`
      SELECT p.id_postulacion, p.estado, p.fecha_postulacion, v.titulo AS vacante, emp.razon_social AS empresa
      FROM postulaciones p
      JOIN vacantes v ON p.id_vacante = v.id_vacante
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      WHERE p.id_estudiante = ?
      ORDER BY p.fecha_postulacion DESC
    `, [id_estudiante]);

    return { ...alumnoRows[0], proyectos, postulaciones };
  }

  static async getAllProfesores() {
    const [rows] = await db.query(`
      SELECT
        pr.id_profesor AS id,
        pr.id_profesor,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        pr.departamento,
        pr.asignaturas,
        COUNT(DISTINCT h.id_horario) AS total_horarios,
        COUNT(DISTINCT p.id_proyecto) AS total_proyectos
      FROM profesores pr
      JOIN usuarios u ON pr.id_profesor = u.id_usuario
      LEFT JOIN horarios_profesores h ON h.id_profesor = pr.id_profesor
      LEFT JOIN proyectos p ON p.id_profesor = pr.id_profesor
      GROUP BY pr.id_profesor, u.id_usuario
      ORDER BY u.nombre ASC
    `);
    return rows;
  }

  static async getProfesorDetalle(id_profesor) {
    const [profRows] = await db.query(`
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.foto_perfil,
        u.estado AS estado_usuario,
        u.fecha_registro,
        pr.id_profesor,
        pr.departamento,
        pr.asignaturas
      FROM profesores pr
      JOIN usuarios u ON pr.id_profesor = u.id_usuario
      WHERE pr.id_profesor = ?
      LIMIT 1
    `, [id_profesor]);

    if (!profRows.length) return null;

    const [horarios] = await db.query(`
      SELECT id_horario, titulo, descripcion, ruta_pdf, tipo_archivo, fecha_subida
      FROM horarios_profesores
      WHERE id_profesor = ?
      ORDER BY fecha_subida DESC
    `, [id_profesor]);

    const [proyectosRaw] = await db.query(`
      SELECT id_proyecto, titulo, descripcion, estado, fecha_registro, img_principal, tecnologias, objetivo, actividades, ambito_desarrollo, area_trabajo
      FROM proyectos
      WHERE id_profesor = ?
      ORDER BY fecha_registro DESC
    `, [id_profesor]);
    const proyectos = await Proyecto.attachMedia(proyectosRaw);

    return { ...profRows[0], horarios, proyectos };
  }

  static async getAllProyectos() {
    const [rows] = await db.query(`
      SELECT
        p.id_proyecto AS id,
        p.id_proyecto,
        p.titulo,
        p.descripcion,
        p.objetivo,
        p.actividades,
        p.ambito_desarrollo,
        p.area_trabajo,
        p.competencia_impacto,
        COALESCE(CONCAT(ue.nombre, ' ', ue.apellido), CONCAT(up.nombre, ' ', up.apellido)) AS autor,
        COALESCE(ue.foto_perfil, up.foto_perfil) AS foto_autor,
        CASE WHEN p.id_profesor IS NOT NULL THEN 'Profesor' ELSE 'Estudiante' END AS tipo_autor,
        p.fecha_registro AS fecha,
        p.estado,
        p.img_principal,
        p.tecnologias
      FROM proyectos p
      LEFT JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      LEFT JOIN usuarios ue ON e.id_estudiante = ue.id_usuario
      LEFT JOIN profesores pr ON p.id_profesor = pr.id_profesor
      LEFT JOIN usuarios up ON pr.id_profesor = up.id_usuario
      ORDER BY p.fecha_registro DESC
    `);
    return Proyecto.attachMedia(rows);
  }

  static async getProyectoDetalle(id_proyecto) {
    const [rows] = await db.query(`
      SELECT p.*,
        COALESCE(CONCAT(ue.nombre, ' ', ue.apellido), CONCAT(up.nombre, ' ', up.apellido)) AS autor,
        COALESCE(ue.correo, up.correo) AS autor_correo,
        COALESCE(ue.foto_perfil, up.foto_perfil) AS foto_autor,
        COALESCE(e.carrera, pr.departamento, 'UTEQ') AS area_autor,
        CASE WHEN p.id_profesor IS NOT NULL THEN 'Profesor' ELSE 'Estudiante' END AS tipo_autor
      FROM proyectos p
      LEFT JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      LEFT JOIN usuarios ue ON e.id_estudiante = ue.id_usuario
      LEFT JOIN profesores pr ON p.id_profesor = pr.id_profesor
      LEFT JOIN usuarios up ON pr.id_profesor = up.id_usuario
      WHERE p.id_proyecto = ?
      LIMIT 1
    `, [id_proyecto]);
    if (!rows.length) return null;
    const media = await Proyecto.getMedia(id_proyecto);
    const [colaboradores] = await db.query(`
      SELECT u.nombre, u.apellido, u.correo, e.matricula, e.carrera
      FROM proyecto_colaboradores pc
      JOIN estudiantes e ON pc.id_estudiante = e.id_estudiante
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      WHERE pc.id_proyecto = ?
      ORDER BY u.nombre ASC
    `, [id_proyecto]).catch(() => [[]]);
    const [evidencias] = await db.query(`
      SELECT id_evidencia, ruta_archivo, tipo, nombre_original, mime_type, tamano_bytes, hash_archivo, fecha_subida
      FROM evidencias
      WHERE id_proyecto = ?
      ORDER BY fecha_subida DESC, id_evidencia DESC
    `, [id_proyecto]).catch(() => [[]]);
    return { ...rows[0], media, colaboradores, evidencias };
  }

  static async getAllVacantes() {
    const [rows] = await db.query(`
      SELECT
        v.id_vacante AS id,
        v.id_vacante,
        v.titulo,
        emp.razon_social AS empresa,
        emp.estado AS estado_empresa,
        v.nivel,
        v.categoria,
        v.estado,
        v.fecha_registro,
        COUNT(p.id_postulacion) AS total_postulaciones
      FROM vacantes v
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      LEFT JOIN postulaciones p ON p.id_vacante = v.id_vacante
      GROUP BY v.id_vacante, emp.razon_social, emp.estado
      ORDER BY v.fecha_registro DESC
    `);
    return rows;
  }

  static async getVacanteDetalle(id_vacante) {
    const [vacanteRows] = await db.query(`
      SELECT v.*, emp.razon_social AS empresa, emp.estado AS estado_empresa
      FROM vacantes v
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      WHERE v.id_vacante = ?
      LIMIT 1
    `, [id_vacante]);

    if (!vacanteRows.length) return null;

    const [postulantes] = await db.query(`
      SELECT
        p.id_postulacion,
        p.estado,
        p.fecha_postulacion,
        u.id_usuario,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.correo,
        u.telefono,
        u.foto_perfil,
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

    return { ...vacanteRows[0], postulantes };
  }

  static async getAllPostulaciones() {
    const [rows] = await db.query(`
      SELECT
        p.id_postulacion,
        p.estado,
        p.fecha_postulacion,
        v.id_vacante,
        v.titulo AS vacante,
        emp.id_empresa,
        emp.razon_social AS empresa,
        u.id_usuario AS id_estudiante,
        CONCAT(u.nombre, ' ', u.apellido) AS alumno,
        u.correo,
        u.foto_perfil,
        e.carrera,
        e.semestre,
        ss.puntaje_total AS soft_score
      FROM postulaciones p
      JOIN vacantes v ON p.id_vacante = v.id_vacante
      JOIN empresas emp ON v.id_empresa = emp.id_empresa
      JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      LEFT JOIN LATERAL (
        SELECT *
        FROM soft_skills_resultados ss2
        WHERE ss2.id_estudiante = e.id_estudiante
        ORDER BY ss2.fecha_realizacion DESC, ss2.id_resultado DESC
        LIMIT 1
      ) ss ON true
      ORDER BY p.fecha_postulacion DESC
    `);
    return rows;
  }

  static async getCandidatosVinculacion() {
    const [rows] = await db.query(`
      SELECT
        u.id_usuario AS id,
        e.id_estudiante,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre,
        u.correo,
        u.telefono,
        u.foto_perfil,
        e.matricula,
        e.carrera,
        e.semestre,
        e.competencias,
        COUNT(DISTINCT p.id_postulacion) AS total_postulaciones,
        COUNT(DISTINCT CASE WHEN p.estado = 'aceptada' THEN p.id_postulacion END) AS postulaciones_aceptadas
      FROM postulaciones p
      JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
      JOIN usuarios u ON e.id_estudiante = u.id_usuario
      GROUP BY u.id_usuario, e.id_estudiante
      ORDER BY total_postulaciones DESC, u.nombre ASC
    `);
    return rows;
  }

  static async getReportesVinculacion() {
    const [empresasPorEstado] = await db.query(`
      SELECT estado, COUNT(*) AS total
      FROM empresas
      GROUP BY estado
      ORDER BY estado
    `);

    const [vacantesPorEstado] = await db.query(`
      SELECT estado, COUNT(*) AS total
      FROM vacantes
      GROUP BY estado
      ORDER BY estado
    `);

    const [postulacionesPorEstado] = await db.query(`
      SELECT estado, COUNT(*) AS total
      FROM postulaciones
      GROUP BY estado
      ORDER BY estado
    `);

    return { empresasPorEstado, vacantesPorEstado, postulacionesPorEstado };
  }

  static async cambiarEstadoUsuario(id_usuario, estado) {
    const [result] = await db.query(`UPDATE usuarios SET estado = ? WHERE id_usuario = ?`, [estado, id_usuario]);
    return result.affectedRows;
  }
}

module.exports = Admin;
