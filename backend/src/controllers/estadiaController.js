const db = require('../config/db');
const { uploadedFilePath } = require('../utils/fileUrl');

const NIVEL_CALIFICACION = { SA: 8, DE: 9, AU: 10 };

function role(req) { return Number(req.usuario?.id_rol || 0); }
function requireRoles(req, res, roles) {
  if (!roles.includes(role(req))) {
    res.status(403).json({ ok: false, mensaje: 'No tienes permisos para realizar esta acción.' });
    return false;
  }
  return true;
}
function filePath(file) { return file ? uploadedFilePath(file, 'evidencias') : null; }
function folioExpediente(idEstadia) {
  return `EST-${new Date().getFullYear()}-${String(idEstadia).padStart(6, '0')}`;
}

async function recalcularExpediente(idEstadia) {
  const [seg] = await db.query("SELECT estado FROM seguros_facultativos WHERE id_estadia=?", [idEstadia]);
  const [av] = await db.query("SELECT COUNT(DISTINCT fa.numero_avance) aprobados FROM entregas_avances_estadia ea JOIN fechas_avances_estadia fa ON fa.id_fecha_avance=ea.id_fecha_avance WHERE ea.id_estadia=? AND ea.estado='aprobado'", [idEstadia]);
  let porcentaje = 35;
  if (seg[0]?.estado === 'validado') porcentaje += 20;
  porcentaje += Math.min(3, Number(av[0]?.aprobados || 0)) * 15;
  porcentaje = Math.min(100, porcentaje);
  const estado = porcentaje >= 100 ? 'completo' : 'incompleto';
  await db.query('UPDATE expedientes_estadia SET porcentaje_completo=?, estado=?, actualizado_en=CURRENT_TIMESTAMP WHERE id_estadia=?', [porcentaje, estado, idEstadia]);
  return porcentaje;
}

async function estudianteByUser(idUsuario) {
  const [rows] = await db.query('SELECT * FROM estudiantes WHERE id_estudiante = ? LIMIT 1', [idUsuario]);
  return rows[0] || null;
}
async function profesorByUser(idUsuario) {
  const [rows] = await db.query('SELECT * FROM profesores WHERE id_profesor = ? LIMIT 1', [idUsuario]);
  return rows[0] || null;
}

exports.resumen = async (req, res) => {
  try {
    const r = role(req);
    if (r === 2) {
      const estudiante = await estudianteByUser(req.usuario.id_usuario);
      if (!estudiante) return res.status(404).json({ ok: false, mensaje: 'Perfil de estudiante no encontrado.' });
      const [rows] = await db.query(`
        SELECT e.*, pe.nombre AS periodo_nombre, pe.clave AS periodo_clave,
               g.nombre AS grupo_nombre, CONCAT(u.nombre,' ',u.apellido) AS profesor_nombre,
               ex.folio AS expediente_folio, ex.estado AS expediente_estado, ex.porcentaje_completo,
               s.estado AS seguro_estado
        FROM estadias e
        JOIN periodos_estadia pe ON pe.id_periodo=e.id_periodo
        JOIN grupos_estadia g ON g.id_grupo=e.id_grupo
        JOIN usuarios u ON u.id_usuario=e.id_profesor
        LEFT JOIN expedientes_estadia ex ON ex.id_estadia=e.id_estadia
        LEFT JOIN seguros_facultativos s ON s.id_estadia=e.id_estadia
        WHERE e.id_estudiante=? ORDER BY e.creada_en DESC LIMIT 1`, [estudiante.id_estudiante]);
      return res.json({ ok: true, estadia: rows[0] || null });
    }
    if (r === 4) {
      const profesor = await profesorByUser(req.usuario.id_usuario);
      const [grupos] = await db.query(`SELECT g.*, p.nombre AS periodo_nombre,
        (SELECT COUNT(*) FROM grupo_estudiantes_estadia ge WHERE ge.id_grupo=g.id_grupo) AS alumnos
        FROM grupos_estadia g JOIN periodos_estadia p ON p.id_periodo=g.id_periodo
        WHERE g.id_profesor=? AND g.activo=TRUE ORDER BY p.fecha_inicio DESC,g.nombre`, [profesor?.id_profesor || 0]);
      return res.json({ ok: true, grupos });
    }
    const [stats] = await db.query(`SELECT
      (SELECT COUNT(*) FROM periodos_estadia WHERE activo=TRUE) AS periodos_activos,
      (SELECT COUNT(*) FROM estadias) AS estadias,
      (SELECT COUNT(*) FROM seguros_facultativos WHERE estado IN ('pendiente','en_revision')) AS seguros_pendientes,
      (SELECT COUNT(*) FROM entregas_avances_estadia WHERE estado IN ('entregado','en_revision')) AS avances_pendientes`);
    return res.json({ ok: true, stats: stats[0] || {} });
  } catch (error) {
    console.error('Error resumen estadias:', error);
    return res.status(500).json({ ok: false, mensaje: 'No se pudo cargar el módulo de estadías.' });
  }
};

exports.listarPeriodos = async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM periodos_estadia ORDER BY fecha_inicio DESC');
    res.json({ ok: true, periodos: rows });
  } catch (e) { res.status(500).json({ ok: false, mensaje: 'No se pudieron cargar los periodos.' }); }
};

exports.crearPeriodo = async (req, res) => {
  if (!requireRoles(req, res, [1])) return;
  const { nombre, clave, fecha_inicio, fecha_fin, fecha_limite_registro_empresa, fecha_limite_seguro, instrucciones } = req.body;
  if (!nombre || !clave || !fecha_inicio || !fecha_fin) return res.status(400).json({ ok:false, mensaje:'Nombre, clave y fechas son obligatorios.' });
  try {
    const [result] = await db.query(`INSERT INTO periodos_estadia
      (nombre,clave,fecha_inicio,fecha_fin,fecha_limite_registro_empresa,fecha_limite_seguro,instrucciones,creado_por)
      VALUES (?,?,?,?,?,?,?,?)`, [nombre,clave,fecha_inicio,fecha_fin,fecha_limite_registro_empresa||null,fecha_limite_seguro||null,instrucciones||null,req.usuario.id_usuario]);
    res.status(201).json({ ok:true, id_periodo: result.insertId });
  } catch (e) { res.status(500).json({ ok:false, mensaje:e.code==='23505'?'La clave del periodo ya existe.':'No se pudo crear el periodo.' }); }
};

exports.listarGuias = async (_req, res) => {
  try { const [rows] = await db.query(`SELECT g.*,p.nombre periodo_nombre FROM guias_estadia g LEFT JOIN periodos_estadia p ON p.id_periodo=g.id_periodo ORDER BY g.publicada_en DESC`); res.json({ok:true,guias:rows}); }
  catch(e){ res.status(500).json({ok:false,mensaje:'No se pudieron cargar las guías.'}); }
};
exports.crearGuia = async (req,res) => {
  if (!requireRoles(req,res,[1])) return;
  if (!req.file) return res.status(400).json({ok:false,mensaje:'Debes adjuntar la guía.'});
  const { id_periodo, nombre, version, descripcion } = req.body;
  try {
    await db.query('UPDATE guias_estadia SET vigente=FALSE WHERE id_periodo=?', [id_periodo||null]);
    const [result] = await db.query(`INSERT INTO guias_estadia (id_periodo,nombre,version,descripcion,ruta_archivo,mime_type,nombre_original,vigente,publicada_por)
      VALUES (?,?,?,?,?,?,?,?,?)`, [id_periodo||null,nombre||req.file.originalname,version||'1.0',descripcion||null,filePath(req.file),req.file.mimetype,req.file.originalname,true,req.usuario.id_usuario]);
    res.status(201).json({ok:true,id_guia:result.insertId});
  } catch(e){ console.error(e); res.status(500).json({ok:false,mensaje:'No se pudo guardar la guía.'}); }
};

exports.listarRubricas = async (_req,res) => {
  try {
    const [rubricas] = await db.query(`SELECT r.*,p.nombre periodo_nombre FROM rubricas_estadia r LEFT JOIN periodos_estadia p ON p.id_periodo=r.id_periodo ORDER BY r.creada_en DESC`);
    for (const r of rubricas) { const [criterios] = await db.query('SELECT * FROM rubrica_criterios_estadia WHERE id_rubrica=? ORDER BY orden,id_criterio',[r.id_rubrica]); r.criterios=criterios; }
    res.json({ok:true,rubricas});
  } catch(e){ res.status(500).json({ok:false,mensaje:'No se pudieron cargar las rúbricas.'}); }
};
exports.crearRubrica = async (req,res) => {
  if (!requireRoles(req,res,[1])) return;
  const { id_periodo,nombre,descripcion,criterios=[] } = req.body;
  if (!nombre) return res.status(400).json({ok:false,mensaje:'El nombre es obligatorio.'});
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query('INSERT INTO rubricas_estadia (id_periodo,nombre,descripcion,creada_por) VALUES (?,?,?,?)',[id_periodo||null,nombre,descripcion||null,req.usuario.id_usuario]);
    for (let i=0;i<criterios.length;i++) await conn.query('INSERT INTO rubrica_criterios_estadia (id_rubrica,criterio,descripcion,peso,orden) VALUES (?,?,?,?,?)',[r.insertId,criterios[i].criterio,criterios[i].descripcion||null,Number(criterios[i].peso||0),i+1]);
    await conn.commit(); res.status(201).json({ok:true,id_rubrica:r.insertId});
  } catch(e){ await conn.rollback(); res.status(500).json({ok:false,mensaje:'No se pudo crear la rúbrica.'}); } finally { conn.release(); }
};


exports.listarTalleres = async (_req,res) => {
  try {
    const [rows]=await db.query(`SELECT t.*,p.nombre periodo_nombre FROM talleres_estadia t JOIN periodos_estadia p ON p.id_periodo=t.id_periodo ORDER BY t.fecha_hora NULLS LAST,t.id_taller DESC`);
    res.json({ok:true,talleres:rows});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los talleres.'});}
};
exports.crearTaller = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {id_periodo,nombre,descripcion,fecha_hora,modalidad,ubicacion,obligatorio}=req.body;
  if(!id_periodo||!nombre) return res.status(400).json({ok:false,mensaje:'Periodo y nombre son obligatorios.'});
  try {
    const [r]=await db.query(`INSERT INTO talleres_estadia (id_periodo,nombre,descripcion,fecha_hora,modalidad,ubicacion,obligatorio,creado_por) VALUES (?,?,?,?,?,?,?,?)`,[id_periodo,nombre,descripcion||null,fecha_hora||null,modalidad||'presencial',ubicacion||null,obligatorio!==false,req.usuario.id_usuario]);
    res.status(201).json({ok:true,id_taller:r.insertId});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudo crear el taller.'});}
};

exports.listarGrupos = async (req,res) => {
  try {
    let where='', params=[];
    const r=role(req);
    if (r===4) { where='WHERE g.id_profesor=?'; params=[req.usuario.id_usuario]; }
    else if (r===2) { where='WHERE EXISTS (SELECT 1 FROM grupo_estudiantes_estadia ge WHERE ge.id_grupo=g.id_grupo AND ge.id_estudiante=?)'; params=[req.usuario.id_usuario]; }
    else if (![1,5,6].includes(r)) return res.status(403).json({ok:false,mensaje:'No tienes acceso a grupos de estadía.'});
    const [rows] = await db.query(`SELECT g.*,p.nombre periodo_nombre, CONCAT(u.nombre,' ',u.apellido) profesor_nombre,
      (SELECT COUNT(*) FROM grupo_estudiantes_estadia ge WHERE ge.id_grupo=g.id_grupo) alumnos
      FROM grupos_estadia g JOIN periodos_estadia p ON p.id_periodo=g.id_periodo JOIN usuarios u ON u.id_usuario=g.id_profesor ${where}
      ORDER BY p.fecha_inicio DESC,g.nombre`,params);
    res.json({ok:true,grupos:rows});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los grupos.'});}
};

exports.crearGrupo = async (req,res) => {
  if (!requireRoles(req,res,[1])) return;
  const {id_periodo,nombre,carrera,id_profesor}=req.body;
  try { const [r]=await db.query('INSERT INTO grupos_estadia (id_periodo,nombre,carrera,id_profesor) VALUES (?,?,?,?)',[id_periodo,nombre,carrera||null,id_profesor]); res.status(201).json({ok:true,id_grupo:r.insertId}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo crear el grupo.'});}
};
exports.asignarAlumnoGrupo = async (req,res) => {
  if (!requireRoles(req,res,[1])) return;
  try { await db.query('INSERT INTO grupo_estudiantes_estadia (id_grupo,id_estudiante) VALUES (?,?) ON CONFLICT (id_grupo,id_estudiante) DO NOTHING',[req.params.id,req.body.id_estudiante]); res.json({ok:true}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo asignar el alumno.'});}
};
exports.alumnosGrupo = async (req,res) => {
  try {
    const r=role(req);
    if (![1,4,6].includes(r)) return res.status(403).json({ok:false,mensaje:'No tienes acceso a los alumnos del grupo.'});
    if (r===4) {
      const [own]=await db.query('SELECT id_grupo FROM grupos_estadia WHERE id_grupo=? AND id_profesor=?',[req.params.id,req.usuario.id_usuario]);
      if(!own.length) return res.status(403).json({ok:false,mensaje:'Este grupo no está asignado a tu cuenta.'});
    }
    const [rows]=await db.query(`SELECT ge.id_grupo,e.id_estudiante,e.matricula,u.nombre,u.apellido,u.correo,
      es.id_estadia,es.estado AS estado_estadia,ex.folio AS expediente_folio,s.estado AS seguro_estado
      FROM grupo_estudiantes_estadia ge JOIN estudiantes e ON e.id_estudiante=ge.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante
      LEFT JOIN estadias es ON es.id_grupo=ge.id_grupo AND es.id_estudiante=e.id_estudiante
      LEFT JOIN expedientes_estadia ex ON ex.id_estadia=es.id_estadia LEFT JOIN seguros_facultativos s ON s.id_estadia=es.id_estadia
      WHERE ge.id_grupo=? ORDER BY u.apellido,u.nombre`,[req.params.id]);
    res.json({ok:true,alumnos:rows});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los alumnos.'});}
};

exports.guardarFechasGrupo = async (req,res) => {
  if (!requireRoles(req,res,[4])) return;
  const profesor=await profesorByUser(req.usuario.id_usuario);
  const [grupos]=await db.query('SELECT id_grupo FROM grupos_estadia WHERE id_grupo=? AND id_profesor=?',[req.params.id,profesor?.id_profesor||0]);
  if(!grupos.length) return res.status(403).json({ok:false,mensaje:'El grupo no está asignado a este profesor.'});
  try {
    for(const f of req.body.fechas||[]){
      await db.query(`INSERT INTO fechas_avances_estadia (id_grupo,numero_avance,titulo,fecha_apertura,fecha_limite,id_rubrica,permite_reentrega)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT (id_grupo,numero_avance) DO UPDATE SET titulo=EXCLUDED.titulo,fecha_apertura=EXCLUDED.fecha_apertura,fecha_limite=EXCLUDED.fecha_limite,id_rubrica=EXCLUDED.id_rubrica,permite_reentrega=EXCLUDED.permite_reentrega`,
        [req.params.id,f.numero_avance,f.titulo||`Avance ${f.numero_avance}`,f.fecha_apertura||null,f.fecha_limite,f.id_rubrica||null,f.permite_reentrega!==false]);
    }
    res.json({ok:true});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron guardar las fechas.'});}
};
exports.fechasGrupo = async (req,res) => {
  try {
    const r=role(req);
    if (r===2) {
      const [own]=await db.query('SELECT 1 FROM grupo_estudiantes_estadia WHERE id_grupo=? AND id_estudiante=?',[req.params.id,req.usuario.id_usuario]);
      if(!own.length) return res.status(403).json({ok:false,mensaje:'No tienes acceso a este calendario.'});
    } else if (r===4) {
      const [own]=await db.query('SELECT 1 FROM grupos_estadia WHERE id_grupo=? AND id_profesor=?',[req.params.id,req.usuario.id_usuario]);
      if(!own.length) return res.status(403).json({ok:false,mensaje:'No tienes acceso a este calendario.'});
    } else if (![1,5,6].includes(r)) return res.status(403).json({ok:false,mensaje:'Sin permiso.'});
    const [rows]=await db.query('SELECT * FROM fechas_avances_estadia WHERE id_grupo=? ORDER BY numero_avance',[req.params.id]); res.json({ok:true,fechas:rows}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar las fechas.'});}
};

exports.miContextoRegistro = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  try {
    const [rows]=await db.query(`SELECT ge.id_grupo,g.nombre grupo_nombre,g.id_periodo,g.id_profesor,p.nombre periodo_nombre,p.fecha_inicio,p.fecha_fin,
      CONCAT(u.nombre,' ',u.apellido) profesor_nombre
      FROM grupo_estudiantes_estadia ge JOIN grupos_estadia g ON g.id_grupo=ge.id_grupo JOIN periodos_estadia p ON p.id_periodo=g.id_periodo JOIN usuarios u ON u.id_usuario=g.id_profesor
      WHERE ge.id_estudiante=? AND p.activo=TRUE ORDER BY p.fecha_inicio DESC LIMIT 1`,[req.usuario.id_usuario]);
    const [empresas]=await db.query("SELECT id_empresa,razon_social,rfc,ubicacion FROM empresas WHERE estado='habilitada' ORDER BY razon_social");
    res.json({ok:true,contexto:rows[0]||null,empresas});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cargar la configuración de estadía.'});}
};

exports.registrarMiEstadia = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  const estudiante=await estudianteByUser(req.usuario.id_usuario);
  const [ctx]=await db.query(`SELECT g.* FROM grupo_estudiantes_estadia ge JOIN grupos_estadia g ON g.id_grupo=ge.id_grupo JOIN periodos_estadia p ON p.id_periodo=g.id_periodo WHERE ge.id_estudiante=? AND p.activo=TRUE ORDER BY p.fecha_inicio DESC LIMIT 1`,[estudiante?.id_estudiante||0]);
  if(!ctx.length) return res.status(400).json({ok:false,mensaje:'Aún no tienes un grupo de estadía asignado.'});
  const c=ctx[0], b=req.body;
  if(!b.proyecto_titulo) return res.status(400).json({ok:false,mensaje:'El título del proyecto es obligatorio.'});
  let empresa = {
    razon_social: b.empresa_razon_social || null,
    rfc: b.empresa_rfc || null,
    giro: b.empresa_giro || null,
    domicilio: b.empresa_domicilio || null,
    ubicacion: b.empresa_ubicacion || null,
    telefono: b.empresa_telefono || null,
    correo: b.empresa_correo || null,
  };
  if (!b.empresa_externa && b.id_empresa) {
    const [empRows] = await db.query(`SELECT e.razon_social,e.rfc,e.giro,e.domicilio,e.ubicacion,u.telefono,u.correo FROM empresas e JOIN usuarios u ON u.id_usuario=e.id_empresa WHERE e.id_empresa=? LIMIT 1`, [b.id_empresa]);
    if (!empRows.length) return res.status(400).json({ok:false,mensaje:'La empresa seleccionada no existe.'});
    empresa = empRows[0];
  }
  const conn=await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r]=await conn.query(`INSERT INTO estadias (id_periodo,id_estudiante,id_grupo,id_profesor,id_empresa,empresa_externa,empresa_razon_social,empresa_rfc,empresa_giro,empresa_domicilio,empresa_ubicacion,empresa_telefono,empresa_correo,responsable_nombre,responsable_cargo,responsable_correo,responsable_telefono,proyecto_titulo,proyecto_area,proyecto_problematica,proyecto_objetivo_general,proyecto_objetivos_especificos,proyecto_justificacion,proyecto_alcance,proyecto_actividades,proyecto_entregables,proyecto_tecnologias,fecha_inicio,fecha_fin,estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'documentacion_pendiente')
      ON CONFLICT (id_periodo,id_estudiante) DO UPDATE SET id_empresa=EXCLUDED.id_empresa,empresa_externa=EXCLUDED.empresa_externa,empresa_razon_social=EXCLUDED.empresa_razon_social,empresa_rfc=EXCLUDED.empresa_rfc,empresa_giro=EXCLUDED.empresa_giro,empresa_domicilio=EXCLUDED.empresa_domicilio,empresa_ubicacion=EXCLUDED.empresa_ubicacion,empresa_telefono=EXCLUDED.empresa_telefono,empresa_correo=EXCLUDED.empresa_correo,responsable_nombre=EXCLUDED.responsable_nombre,responsable_cargo=EXCLUDED.responsable_cargo,responsable_correo=EXCLUDED.responsable_correo,responsable_telefono=EXCLUDED.responsable_telefono,proyecto_titulo=EXCLUDED.proyecto_titulo,proyecto_area=EXCLUDED.proyecto_area,proyecto_problematica=EXCLUDED.proyecto_problematica,proyecto_objetivo_general=EXCLUDED.proyecto_objetivo_general,proyecto_objetivos_especificos=EXCLUDED.proyecto_objetivos_especificos,proyecto_justificacion=EXCLUDED.proyecto_justificacion,proyecto_alcance=EXCLUDED.proyecto_alcance,proyecto_actividades=EXCLUDED.proyecto_actividades,proyecto_entregables=EXCLUDED.proyecto_entregables,proyecto_tecnologias=EXCLUDED.proyecto_tecnologias,fecha_inicio=EXCLUDED.fecha_inicio,fecha_fin=EXCLUDED.fecha_fin,actualizada_en=CURRENT_TIMESTAMP RETURNING id_estadia`,
      [c.id_periodo,estudiante.id_estudiante,c.id_grupo,c.id_profesor,b.empresa_externa?null:(b.id_empresa||null),Boolean(b.empresa_externa),empresa.razon_social,empresa.rfc,empresa.giro,empresa.domicilio,empresa.ubicacion,empresa.telefono,empresa.correo,b.responsable_nombre||null,b.responsable_cargo||null,b.responsable_correo||null,b.responsable_telefono||null,b.proyecto_titulo,b.proyecto_area||null,b.proyecto_problematica||null,b.proyecto_objetivo_general||null,b.proyecto_objetivos_especificos||null,b.proyecto_justificacion||null,b.proyecto_alcance||null,b.proyecto_actividades||null,b.proyecto_entregables||null,b.proyecto_tecnologias||null,b.fecha_inicio||null,b.fecha_fin||null]);
    const idEstadia=r.rows?.[0]?.id_estadia || r.insertId;
    const [ex]=await conn.query('SELECT id_expediente FROM expedientes_estadia WHERE id_estadia=?',[idEstadia]);
    if(!ex.length) await conn.query('INSERT INTO expedientes_estadia (id_estadia,folio,estado,porcentaje_completo) VALUES (?,?,?,?)',[idEstadia,folioExpediente(idEstadia),'incompleto',35]);
    await conn.commit(); res.json({ok:true,id_estadia:idEstadia});
  } catch(e){ await conn.rollback(); console.error(e); res.status(500).json({ok:false,mensaje:'No se pudo registrar la estadía.'}); } finally {conn.release();}
};

exports.obtenerMiEstadia = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  try {
    const [rows]=await db.query(`SELECT e.*,p.nombre periodo_nombre,g.nombre grupo_nombre,CONCAT(u.nombre,' ',u.apellido) profesor_nombre,ex.folio expediente_folio,ex.estado expediente_estado,ex.porcentaje_completo,s.id_seguro,s.estado seguro_estado,s.observaciones seguro_observaciones,s.ruta_comprobante,s.nombre_original seguro_archivo
      FROM estadias e JOIN periodos_estadia p ON p.id_periodo=e.id_periodo JOIN grupos_estadia g ON g.id_grupo=e.id_grupo JOIN usuarios u ON u.id_usuario=e.id_profesor LEFT JOIN expedientes_estadia ex ON ex.id_estadia=e.id_estadia LEFT JOIN seguros_facultativos s ON s.id_estadia=e.id_estadia WHERE e.id_estudiante=? ORDER BY e.creada_en DESC LIMIT 1`,[req.usuario.id_usuario]);
    if(!rows.length) return res.json({ok:true,estadia:null});
    const estadia=rows[0];
    const [fechas]=await db.query('SELECT * FROM fechas_avances_estadia WHERE id_grupo=? ORDER BY numero_avance',[estadia.id_grupo]);
    const [entregas]=await db.query(`SELECT ea.*,fa.numero_avance,fa.titulo,fa.fecha_limite,ra.nivel,ra.calificacion,ra.observaciones AS revision_observaciones,ra.requiere_correccion FROM entregas_avances_estadia ea JOIN fechas_avances_estadia fa ON fa.id_fecha_avance=ea.id_fecha_avance LEFT JOIN LATERAL (SELECT * FROM revisiones_avances_estadia r WHERE r.id_entrega=ea.id_entrega ORDER BY r.revisado_en DESC LIMIT 1) ra ON TRUE WHERE ea.id_estadia=? ORDER BY fa.numero_avance,ea.version DESC`,[estadia.id_estadia]);
    res.json({ok:true,estadia,fechas,entregas});
  } catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo cargar tu estadía.'});}
};

exports.guardarSeguro = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  if(!req.file) return res.status(400).json({ok:false,mensaje:'Adjunta el comprobante del seguro.'});
  const [est]=await db.query('SELECT id_estadia FROM estadias WHERE id_estudiante=? ORDER BY creada_en DESC LIMIT 1',[req.usuario.id_usuario]);
  if(!est.length) return res.status(400).json({ok:false,mensaje:'Primero registra tu estadía.'});
  const b=req.body;
  try {
    await db.query(`INSERT INTO seguros_facultativos (id_estadia,numero_seguro,folio_pago,fecha_pago,vigencia_inicio,vigencia_fin,monto,ruta_comprobante,mime_type,nombre_original,estado)
      VALUES (?,?,?,?,?,?,?,?,?,?,'pendiente') ON CONFLICT (id_estadia) DO UPDATE SET numero_seguro=EXCLUDED.numero_seguro,folio_pago=EXCLUDED.folio_pago,fecha_pago=EXCLUDED.fecha_pago,vigencia_inicio=EXCLUDED.vigencia_inicio,vigencia_fin=EXCLUDED.vigencia_fin,monto=EXCLUDED.monto,ruta_comprobante=EXCLUDED.ruta_comprobante,mime_type=EXCLUDED.mime_type,nombre_original=EXCLUDED.nombre_original,estado='pendiente',observaciones=NULL,validado_por=NULL,validado_en=NULL`,
      [est[0].id_estadia,b.numero_seguro||null,b.folio_pago||null,b.fecha_pago||null,b.vigencia_inicio||null,b.vigencia_fin||null,b.monto||null,filePath(req.file),req.file.mimetype,req.file.originalname]);
    res.json({ok:true});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudo registrar el seguro.'});}
};

exports.listarSeguros = async (req,res) => {
  if (!requireRoles(req,res,[1,6])) return;
  try { const [rows]=await db.query(`SELECT s.*,e.id_estudiante,es.matricula,u.nombre,u.apellido,u.correo,e.proyecto_titulo,e.empresa_razon_social,p.nombre periodo_nombre FROM seguros_facultativos s JOIN estadias e ON e.id_estadia=s.id_estadia JOIN estudiantes es ON es.id_estudiante=e.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante JOIN periodos_estadia p ON p.id_periodo=e.id_periodo ORDER BY s.creado_en DESC`); res.json({ok:true,seguros:rows}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los seguros.'});}
};
exports.validarSeguro = async (req,res) => {
  if (!requireRoles(req,res,[1,6])) return;
  const {estado,observaciones}=req.body;
  if(!['en_revision','validado','requiere_correccion','rechazado'].includes(estado)) return res.status(400).json({ok:false,mensaje:'Estado inválido.'});
  try { await db.query('UPDATE seguros_facultativos SET estado=?,observaciones=?,validado_por=?,validado_en=CURRENT_TIMESTAMP WHERE id_seguro=?',[estado,observaciones||null,req.usuario.id_usuario,req.params.id]);
    const [sg]=await db.query('SELECT id_estadia FROM seguros_facultativos WHERE id_seguro=?',[req.params.id]);
    if(sg[0]) { if(estado==='validado') await db.query("UPDATE estadias SET estado='en_estadia',actualizada_en=CURRENT_TIMESTAMP WHERE id_estadia=?",[sg[0].id_estadia]); await recalcularExpediente(sg[0].id_estadia); }
    res.json({ok:true}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo actualizar el seguro.'});}
};

exports.entregarAvance = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  if(!req.file) return res.status(400).json({ok:false,mensaje:'Adjunta el archivo del avance.'});
  try {
    const [est]=await db.query('SELECT * FROM estadias WHERE id_estudiante=? ORDER BY creada_en DESC LIMIT 1',[req.usuario.id_usuario]);
    if(!est.length) return res.status(400).json({ok:false,mensaje:'No tienes una estadía registrada.'});
    const [fecha]=await db.query('SELECT * FROM fechas_avances_estadia WHERE id_fecha_avance=? AND id_grupo=?',[req.params.idFecha,est[0].id_grupo]);
    if(!fecha.length) return res.status(404).json({ok:false,mensaje:'Entrega no encontrada.'});
    const ahora=new Date(), limite=new Date(fecha[0].fecha_limite);
    if(ahora>limite) return res.status(400).json({ok:false,mensaje:'La fecha límite ya venció. No se permiten entregas tardías.'});
    const [prev]=await db.query('SELECT COALESCE(MAX(version),0) max_version FROM entregas_avances_estadia WHERE id_estadia=? AND id_fecha_avance=?',[est[0].id_estadia,req.params.idFecha]);
    const version=Number(prev[0].max_version||0)+1;
    if(version>1 && !fecha[0].permite_reentrega) return res.status(400).json({ok:false,mensaje:'Este avance no permite una nueva versión.'});
    await db.query(`INSERT INTO entregas_avances_estadia (id_estadia,id_fecha_avance,version,ruta_archivo,mime_type,nombre_original,comentario_estudiante,estado,es_tardia) VALUES (?,?,?,?,?,?,?,'entregado',FALSE)`,[est[0].id_estadia,req.params.idFecha,version,filePath(req.file),req.file.mimetype,req.file.originalname,req.body.comentario||null]);
    res.json({ok:true,version});
  } catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo entregar el avance.'});}
};

exports.entregasProfesor = async (req,res) => {
  if (!requireRoles(req,res,[4])) return;
  try { const [rows]=await db.query(`SELECT ea.*,fa.numero_avance,fa.titulo,fa.fecha_limite,e.id_estudiante,e.proyecto_titulo,es.matricula,u.nombre,u.apellido,g.nombre grupo_nombre,
    rr.nivel,rr.calificacion,rr.observaciones revision_observaciones,rr.requiere_correccion
    FROM entregas_avances_estadia ea JOIN fechas_avances_estadia fa ON fa.id_fecha_avance=ea.id_fecha_avance JOIN estadias e ON e.id_estadia=ea.id_estadia JOIN estudiantes es ON es.id_estudiante=e.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante JOIN grupos_estadia g ON g.id_grupo=e.id_grupo
    LEFT JOIN LATERAL (SELECT * FROM revisiones_avances_estadia r WHERE r.id_entrega=ea.id_entrega ORDER BY r.revisado_en DESC LIMIT 1) rr ON TRUE
    WHERE e.id_profesor=? ORDER BY ea.entregado_en DESC`,[req.usuario.id_usuario]); res.json({ok:true,entregas:rows}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar las entregas.'});}
};
exports.revisarEntrega = async (req,res) => {
  if (!requireRoles(req,res,[4])) return;
  const nivel=String(req.body.nivel||'').toUpperCase();
  if(!NIVEL_CALIFICACION[nivel]) return res.status(400).json({ok:false,mensaje:'Selecciona SA, DE o AU.'});
  try {
    const [rows]=await db.query(`SELECT ea.id_entrega,e.id_profesor FROM entregas_avances_estadia ea JOIN estadias e ON e.id_estadia=ea.id_estadia WHERE ea.id_entrega=?`,[req.params.id]);
    if(!rows.length || Number(rows[0].id_profesor)!==Number(req.usuario.id_usuario)) return res.status(403).json({ok:false,mensaje:'No puedes revisar esta entrega.'});
    const requiere=Boolean(req.body.requiere_correccion);
    await db.query('INSERT INTO revisiones_avances_estadia (id_entrega,id_profesor,nivel,calificacion,observaciones,requiere_correccion) VALUES (?,?,?,?,?,?)',[req.params.id,req.usuario.id_usuario,nivel,NIVEL_CALIFICACION[nivel],req.body.observaciones||null,requiere]);
    await db.query('UPDATE entregas_avances_estadia SET estado=? WHERE id_entrega=?',[requiere?'requiere_correccion':'aprobado',req.params.id]);
    const [ent]=await db.query('SELECT id_estadia FROM entregas_avances_estadia WHERE id_entrega=?',[req.params.id]);
    if(ent[0]) await recalcularExpediente(ent[0].id_estadia);
    res.json({ok:true,calificacion:NIVEL_CALIFICACION[nivel]});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudo guardar la revisión.'});}
};

exports.listarExpedientes = async (req,res) => {
  if(!requireRoles(req,res,[1,6])) return;
  try { const [rows]=await db.query(`SELECT ex.*,e.id_estadia,e.id_estudiante,e.proyecto_titulo,e.empresa_razon_social,e.estado estado_estadia,es.matricula,u.nombre,u.apellido,u.correo,p.nombre periodo_nombre,s.estado seguro_estado,g.nombre grupo_nombre,CONCAT(up.nombre,' ',up.apellido) profesor_nombre FROM expedientes_estadia ex JOIN estadias e ON e.id_estadia=ex.id_estadia JOIN estudiantes es ON es.id_estudiante=e.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante JOIN periodos_estadia p ON p.id_periodo=e.id_periodo JOIN grupos_estadia g ON g.id_grupo=e.id_grupo JOIN usuarios up ON up.id_usuario=e.id_profesor LEFT JOIN seguros_facultativos s ON s.id_estadia=e.id_estadia ORDER BY ex.creado_en DESC`); res.json({ok:true,expedientes:rows}); }
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los expedientes.'});}
};


exports.detalleExpediente = async (req,res) => {
  if(!requireRoles(req,res,[1,6])) return;
  try {
    const [rows]=await db.query(`SELECT ex.*,e.*,p.nombre periodo_nombre,g.nombre grupo_nombre,
      es.matricula,es.carrera,es.semestre AS cuatrimestre_actual,es.competencias,es.titulo_profesional,es.biografia,es.idiomas,es.disponibilidad,es.modalidad_preferida,es.ciudad,
      u.nombre,u.apellido,u.correo,u.telefono,u.foto_perfil,u.fecha_registro,
      CONCAT(up.nombre,' ',up.apellido) profesor_nombre,up.correo profesor_correo,
      s.id_seguro,s.numero_seguro,s.folio_pago,s.fecha_pago,s.vigencia_inicio,s.vigencia_fin,s.monto,s.ruta_comprobante,s.estado seguro_estado,s.observaciones seguro_observaciones
      FROM expedientes_estadia ex JOIN estadias e ON e.id_estadia=ex.id_estadia JOIN estudiantes es ON es.id_estudiante=e.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante
      JOIN periodos_estadia p ON p.id_periodo=e.id_periodo JOIN grupos_estadia g ON g.id_grupo=e.id_grupo JOIN usuarios up ON up.id_usuario=e.id_profesor
      LEFT JOIN seguros_facultativos s ON s.id_estadia=e.id_estadia WHERE ex.id_expediente=? LIMIT 1`,[req.params.id]);
    if(!rows.length) return res.status(404).json({ok:false,mensaje:'Expediente no encontrado.'});
    const expediente=rows[0];
    const [entregas]=await db.query(`SELECT ea.*,fa.numero_avance,fa.titulo,fa.fecha_limite,rr.nivel,rr.calificacion,rr.observaciones revision_observaciones,rr.requiere_correccion
      FROM entregas_avances_estadia ea JOIN fechas_avances_estadia fa ON fa.id_fecha_avance=ea.id_fecha_avance
      LEFT JOIN LATERAL (SELECT * FROM revisiones_avances_estadia r WHERE r.id_entrega=ea.id_entrega ORDER BY r.revisado_en DESC LIMIT 1) rr ON TRUE
      WHERE ea.id_estadia=? ORDER BY fa.numero_avance,ea.version`,[expediente.id_estadia]);
    res.json({ok:true,expediente,entregas});
  } catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo cargar el expediente completo.'});}
};

exports.catalogosAdmin = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  try {
    const [profesores]=await db.query(`SELECT p.id_profesor,CONCAT(u.nombre,' ',u.apellido) nombre,u.correo FROM profesores p JOIN usuarios u ON u.id_usuario=p.id_profesor WHERE u.estado='activo' ORDER BY u.apellido,u.nombre`);
    const [estudiantes]=await db.query(`SELECT e.id_estudiante,e.matricula,CONCAT(u.nombre,' ',u.apellido) nombre,u.correo,e.carrera FROM estudiantes e JOIN usuarios u ON u.id_usuario=e.id_estudiante WHERE u.estado='activo' ORDER BY u.apellido,u.nombre`);
    res.json({ok:true,profesores,estudiantes});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los catálogos.'});}
};
