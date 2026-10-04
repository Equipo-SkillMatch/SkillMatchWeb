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
  const [mem] = await db.query("SELECT memoria_final_ruta FROM estadias WHERE id_estadia=?", [idEstadia]);
  let porcentaje = 20;
  if (seg[0]?.estado === 'validado') porcentaje += 20;
  porcentaje += Math.min(3, Number(av[0]?.aprobados || 0)) * 15;
  if (mem[0]?.memoria_final_ruta) porcentaje += 15;
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
    else if (![1,6].includes(r)) return res.status(403).json({ok:false,mensaje:'No tienes acceso a grupos de estadía.'});
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
    } else if (![1,6].includes(r)) return res.status(403).json({ok:false,mensaje:'Sin permiso.'});
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
    if(!ex.length) await conn.query('INSERT INTO expedientes_estadia (id_estadia,folio,estado,porcentaje_completo) VALUES (?,?,?,?)',[idEstadia,folioExpediente(idEstadia),'incompleto',20]);
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
  if(!['SA','DE','AU'].includes(nivel)) return res.status(400).json({ok:false,mensaje:'Selecciona SA, DE o AU.'});
  try {
    const [rows]=await db.query(`SELECT ea.id_entrega,e.id_profesor FROM entregas_avances_estadia ea JOIN estadias e ON e.id_estadia=ea.id_estadia WHERE ea.id_entrega=?`,[req.params.id]);
    if(!rows.length || Number(rows[0].id_profesor)!==Number(req.usuario.id_usuario)) return res.status(403).json({ok:false,mensaje:'No puedes revisar esta entrega.'});
    const requiere=Boolean(req.body.requiere_correccion);
    const cfg=await configCalificaciones();
    const valores={SA:Number(cfg.valor_sa),DE:Number(cfg.valor_de),AU:Number(cfg.valor_au)};
    await db.query('INSERT INTO revisiones_avances_estadia (id_entrega,id_profesor,nivel,calificacion,observaciones,requiere_correccion) VALUES (?,?,?,?,?,?)',[req.params.id,req.usuario.id_usuario,nivel,valores[nivel],req.body.observaciones||null,requiere]);
    await db.query('UPDATE entregas_avances_estadia SET estado=? WHERE id_entrega=?',[requiere?'requiere_correccion':'aprobado',req.params.id]);
    const [ent]=await db.query('SELECT id_estadia FROM entregas_avances_estadia WHERE id_entrega=?',[req.params.id]);
    if(ent[0]) await recalcularExpediente(ent[0].id_estadia);
    res.json({ok:true,calificacion:valores[nivel]});
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

// ========================= SKILLMATCH V6 =========================
async function configCalificaciones() {
  const [rows] = await db.query('SELECT valor_sa,valor_de,valor_au FROM configuracion_calificaciones_estadia WHERE id_config=1');
  return rows[0] || { valor_sa: 8, valor_de: 9, valor_au: 10 };
}

exports.actualizarPeriodo = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {nombre,clave,fecha_inicio,fecha_fin,fecha_limite_registro_empresa,fecha_limite_seguro,instrucciones,activo}=req.body;
  try{
    await db.query(`UPDATE periodos_estadia SET nombre=COALESCE(?,nombre),clave=COALESCE(?,clave),fecha_inicio=COALESCE(?,fecha_inicio),fecha_fin=COALESCE(?,fecha_fin),fecha_limite_registro_empresa=?,fecha_limite_seguro=?,instrucciones=?,activo=COALESCE(?,activo) WHERE id_periodo=?`,
      [nombre||null,clave||null,fecha_inicio||null,fecha_fin||null,fecha_limite_registro_empresa||null,fecha_limite_seguro||null,instrucciones||null,activo===undefined?null:Boolean(activo),req.params.id]);
    res.json({ok:true});
  }catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo actualizar el periodo.'});}
};

exports.catalogosV6 = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  try{
    const [carreras]=await db.query('SELECT id_carrera,nombre FROM carreras ORDER BY nombre');
    const [gruposEscolares]=await db.query(`SELECT ge.*,c.nombre carrera,(SELECT COUNT(*) FROM estudiantes e WHERE e.id_grupo_escolar=ge.id_grupo_escolar) alumnos FROM grupos_escolares ge JOIN carreras c ON c.id_carrera=ge.id_carrera ORDER BY c.nombre,ge.generacion,ge.nombre`);
    const [profesores]=await db.query(`SELECT p.id_profesor,p.id_carrera,p.tutor_estadia,u.nombre,u.apellido,u.correo,c.nombre carrera FROM profesores p JOIN usuarios u ON u.id_usuario=p.id_profesor LEFT JOIN carreras c ON c.id_carrera=p.id_carrera WHERE u.estado='activo' ORDER BY u.apellido,u.nombre`);
    const [estudiantes]=await db.query(`SELECT e.id_estudiante,e.matricula,e.carrera,e.id_grupo_escolar,u.nombre,u.apellido,u.correo,u.estado estado_usuario,ge.nombre grupo_escolar,ge.generacion FROM estudiantes e JOIN usuarios u ON u.id_usuario=e.id_estudiante LEFT JOIN grupos_escolares ge ON ge.id_grupo_escolar=e.id_grupo_escolar ORDER BY e.carrera,ge.nombre,u.apellido,u.nombre`);
    const config=await configCalificaciones();
    res.json({ok:true,carreras,gruposEscolares,profesores,estudiantes,config});
  }catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudieron cargar los catálogos V6.'});}
};

exports.crearGrupoEscolar = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {nombre,id_carrera,generacion}=req.body;
  if(!nombre||!id_carrera) return res.status(400).json({ok:false,mensaje:'Nombre y carrera son obligatorios.'});
  try{const [r]=await db.query('INSERT INTO grupos_escolares(nombre,id_carrera,generacion,creado_por) VALUES(?,?,?,?)',[nombre,id_carrera,generacion||null,req.usuario.id_usuario]);res.status(201).json({ok:true,id_grupo_escolar:r.insertId});}
  catch(e){res.status(500).json({ok:false,mensaje:e.code==='23505'?'Ese grupo ya existe.':'No se pudo crear el grupo escolar.'});}
};

exports.actualizarAlumnoEscolar = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {id_grupo_escolar,estado}=req.body;
  try{
    if(id_grupo_escolar!==undefined) await db.query('UPDATE estudiantes SET id_grupo_escolar=? WHERE id_estudiante=?',[id_grupo_escolar||null,req.params.id]);
    if(estado) await db.query('UPDATE usuarios SET estado=? WHERE id_usuario=?',[estado,req.params.id]);
    res.json({ok:true});
  }catch(e){res.status(500).json({ok:false,mensaje:'No se pudo actualizar el alumno.'});}
};

exports.actualizarProfesorTutor = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {tutor_estadia,id_carrera}=req.body;
  try{await db.query('UPDATE profesores SET tutor_estadia=?,id_carrera=? WHERE id_profesor=?',[Boolean(tutor_estadia),id_carrera||null,req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo actualizar el profesor.'});}
};

exports.guardarGruposPeriodo = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const ids=Array.isArray(req.body.id_grupos_escolares)?req.body.id_grupos_escolares.map(Number).filter(Boolean):[];
  const conn=await db.getConnection();
  try{await conn.beginTransaction();await conn.query('DELETE FROM periodo_grupos_escolares WHERE id_periodo=?',[req.params.id]);for(const id of ids) await conn.query('INSERT INTO periodo_grupos_escolares(id_periodo,id_grupo_escolar) VALUES(?,?)',[req.params.id,id]);await conn.commit();res.json({ok:true});}
  catch(e){await conn.rollback();res.status(500).json({ok:false,mensaje:'No se pudo guardar la selección de grupos.'});}finally{conn.release();}
};

exports.obtenerGruposPeriodo = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  try{const [rows]=await db.query('SELECT id_grupo_escolar FROM periodo_grupos_escolares WHERE id_periodo=?',[req.params.id]);res.json({ok:true,id_grupos_escolares:rows.map(x=>x.id_grupo_escolar)});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cargar la selección.'});}
};

function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

exports.generarGruposEstadia = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const idPeriodo=Number(req.params.id);
  const conn=await db.getConnection();
  try{
    const [seleccion]=await conn.query(`SELECT pge.id_grupo_escolar,ge.id_carrera,ge.generacion,c.nombre carrera FROM periodo_grupos_escolares pge JOIN grupos_escolares ge ON ge.id_grupo_escolar=pge.id_grupo_escolar JOIN carreras c ON c.id_carrera=ge.id_carrera WHERE pge.id_periodo=?`,[idPeriodo]);
    if(!seleccion.length) return res.status(400).json({ok:false,mensaje:'Selecciona primero los grupos escolares que salen a estadía.'});
    const carreras=[...new Map(seleccion.map(x=>[Number(x.id_carrera),x])).values()];
    const [existentes]=await conn.query('SELECT COUNT(*) total FROM estadias WHERE id_periodo=?',[idPeriodo]);
    if(Number(existentes[0]?.total||0)>0) return res.status(400).json({ok:false,mensaje:'Este periodo ya tiene estadías registradas. No puede regenerarse automáticamente; ajusta los tutores de forma manual.'});
    await conn.beginTransaction();
    await conn.query('DELETE FROM grupos_estadia WHERE id_periodo=?',[idPeriodo]);
    let creados=0;
    for(const car of carreras){
      const gruposOrigen=seleccion.filter(x=>Number(x.id_carrera)===Number(car.id_carrera)).map(x=>x.id_grupo_escolar);
      const marks=gruposOrigen.map(()=>'?').join(',');
      const [alumnos]=await conn.query(`SELECT e.id_estudiante FROM estudiantes e JOIN usuarios u ON u.id_usuario=e.id_estudiante WHERE e.id_grupo_escolar IN (${marks}) AND u.estado='activo' ORDER BY e.id_estudiante`,gruposOrigen);
      const [tutores]=await conn.query(`SELECT p.id_profesor FROM profesores p JOIN usuarios u ON u.id_usuario=p.id_profesor WHERE p.tutor_estadia=TRUE AND p.id_carrera=? AND u.estado='activo' ORDER BY p.id_profesor`,[car.id_carrera]);
      if(!alumnos.length) continue;
      const gruposNecesarios=Math.ceil(alumnos.length/6);
      if(tutores.length<gruposNecesarios) throw new Error(`${car.carrera}: se requieren ${gruposNecesarios} tutores activos y solo hay ${tutores.length}.`);
      const aa=shuffle(alumnos), tt=shuffle(tutores);
      for(let g=0;g<gruposNecesarios;g++){
        const miembros=aa.slice(g*6,(g+1)*6);
        const nombre=`${String(car.carrera).replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/g,'').slice(0,6).toUpperCase()}-EST-${String(g+1).padStart(2,'0')}`;
        const [rg]=await conn.query('INSERT INTO grupos_estadia(id_periodo,nombre,carrera,id_profesor,activo,id_carrera,generacion,max_alumnos) VALUES(?,?,?,?,TRUE,?,?,6)',[idPeriodo,nombre,car.carrera,tt[g].id_profesor,car.id_carrera,car.generacion||null]);
        for(const a of miembros) await conn.query('INSERT INTO grupo_estudiantes_estadia(id_grupo,id_estudiante) VALUES(?,?)',[rg.insertId,a.id_estudiante]);
        const [tws]=await conn.query('SELECT * FROM talleres_estadia WHERE id_periodo=? AND numero_entrega BETWEEN 1 AND 3 AND fecha_cierre IS NOT NULL',[idPeriodo]);
        for(const tw of tws) await conn.query(`INSERT INTO fechas_avances_estadia(id_grupo,numero_avance,titulo,fecha_apertura,fecha_limite,id_rubrica,permite_reentrega) VALUES(?,?,?,?,?,?,TRUE) ON CONFLICT(id_grupo,numero_avance) DO UPDATE SET titulo=EXCLUDED.titulo,fecha_apertura=EXCLUDED.fecha_apertura,fecha_limite=EXCLUDED.fecha_limite,id_rubrica=EXCLUDED.id_rubrica`,[rg.insertId,tw.numero_entrega,tw.nombre,tw.fecha_apertura||null,tw.fecha_cierre,tw.id_rubrica||null]);
        creados++;
      }
    }
    await conn.commit();res.json({ok:true,grupos_creados:creados});
  }catch(e){try{await conn.rollback();}catch{};res.status(400).json({ok:false,mensaje:e.message||'No se pudieron generar los grupos.'});}finally{conn.release();}
};

exports.actualizarTaller = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {nombre,descripcion,fecha_apertura,fecha_cierre,modalidad,ubicacion,obligatorio,numero_entrega,id_rubrica}=req.body;
  try{await db.query(`UPDATE talleres_estadia SET nombre=COALESCE(?,nombre),descripcion=?,fecha_apertura=?,fecha_cierre=?,fecha_hora=COALESCE(?,fecha_hora),modalidad=COALESCE(?,modalidad),ubicacion=?,obligatorio=COALESCE(?,obligatorio),numero_entrega=?,id_rubrica=? WHERE id_taller=?`,[nombre||null,descripcion||null,fecha_apertura||null,fecha_cierre||null,fecha_cierre||null,modalidad||null,ubicacion||null,obligatorio===undefined?null:Boolean(obligatorio),numero_entrega||null,id_rubrica||null,req.params.id]);
    const [tw]=await db.query('SELECT * FROM talleres_estadia WHERE id_taller=?',[req.params.id]);if(tw[0]?.numero_entrega&&tw[0]?.fecha_cierre){const [gs]=await db.query('SELECT id_grupo FROM grupos_estadia WHERE id_periodo=?',[tw[0].id_periodo]);for(const g of gs) await db.query(`INSERT INTO fechas_avances_estadia(id_grupo,numero_avance,titulo,fecha_apertura,fecha_limite,id_rubrica,permite_reentrega) VALUES(?,?,?,?,?,?,TRUE) ON CONFLICT(id_grupo,numero_avance) DO UPDATE SET titulo=EXCLUDED.titulo,fecha_apertura=EXCLUDED.fecha_apertura,fecha_limite=EXCLUDED.fecha_limite,id_rubrica=EXCLUDED.id_rubrica`,[g.id_grupo,tw[0].numero_entrega,tw[0].nombre,tw[0].fecha_apertura||null,tw[0].fecha_cierre,tw[0].id_rubrica||null]);}
    res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo editar el taller.'});}
};

exports.obtenerCalificaciones = async (_req,res) => {try{res.json({ok:true,config:await configCalificaciones()});}catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cargar la configuración.'});}};
exports.actualizarCalificaciones = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {valor_sa,valor_de,valor_au}=req.body;
  if([valor_sa,valor_de,valor_au].some(v=>Number.isNaN(Number(v)))) return res.status(400).json({ok:false,mensaje:'Los tres valores deben ser numéricos.'});
  try{await db.query('UPDATE configuracion_calificaciones_estadia SET valor_sa=?,valor_de=?,valor_au=?,actualizado_por=?,actualizado_en=CURRENT_TIMESTAMP WHERE id_config=1',[valor_sa,valor_de,valor_au,req.usuario.id_usuario]);res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo actualizar la escala.'});}
};

exports.alumnosServicios = async (req,res) => {
  if(!requireRoles(req,res,[1,6])) return;
  try{const [rows]=await db.query(`SELECT e.*,u.nombre,u.apellido,u.correo,u.telefono,u.foto_perfil,u.estado estado_usuario,ge.nombre grupo_escolar,ge.generacion,c.nombre carrera_catalogo FROM estudiantes e JOIN usuarios u ON u.id_usuario=e.id_estudiante LEFT JOIN grupos_escolares ge ON ge.id_grupo_escolar=e.id_grupo_escolar LEFT JOIN carreras c ON c.id_carrera=ge.id_carrera ORDER BY COALESCE(c.nombre,e.carrera),ge.nombre,u.apellido,u.nombre`);res.json({ok:true,alumnos:rows});}
  catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudieron cargar los alumnos.'});}
};

exports.gruposProfesor = async (req,res) => {
  if(!requireRoles(req,res,[4])) return;
  try{const [rows]=await db.query(`SELECT g.*,p.nombre periodo_nombre,p.clave periodo_clave,(SELECT COUNT(*) FROM grupo_estudiantes_estadia ge WHERE ge.id_grupo=g.id_grupo) total_alumnos FROM grupos_estadia g JOIN periodos_estadia p ON p.id_periodo=g.id_periodo WHERE g.id_profesor=? AND g.activo=TRUE ORDER BY p.fecha_inicio DESC,g.nombre`,[req.usuario.id_usuario]);res.json({ok:true,grupos:rows});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar tus grupos.'});}
};

exports.detalleGrupoProfesor = async (req,res) => {
  if(!requireRoles(req,res,[4])) return;
  try{const [g]=await db.query('SELECT * FROM grupos_estadia WHERE id_grupo=? AND id_profesor=? LIMIT 1',[req.params.id,req.usuario.id_usuario]);if(!g.length)return res.status(404).json({ok:false,mensaje:'Grupo no encontrado.'});const [alumnos]=await db.query(`SELECT e.id_estudiante,e.matricula,e.carrera,u.nombre,u.apellido,u.correo,u.telefono,es.id_estadia,es.empresa_razon_social,es.responsable_nombre,es.horario_laboral,es.proyecto_titulo,es.estado,es.memoria_final_ruta,es.memoria_final_habilitada,
      (SELECT ROUND(AVG(x.calificacion),2) FROM (SELECT DISTINCT ON (fa.numero_avance) r.calificacion,fa.numero_avance FROM entregas_avances_estadia ea JOIN fechas_avances_estadia fa ON fa.id_fecha_avance=ea.id_fecha_avance JOIN revisiones_avances_estadia r ON r.id_entrega=ea.id_entrega WHERE ea.id_estadia=es.id_estadia ORDER BY fa.numero_avance,r.revisado_en DESC) x) promedio_estadia FROM grupo_estudiantes_estadia ge JOIN estudiantes e ON e.id_estudiante=ge.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante LEFT JOIN estadias es ON es.id_grupo=ge.id_grupo AND es.id_estudiante=e.id_estudiante WHERE ge.id_grupo=? ORDER BY u.apellido,u.nombre`,[req.params.id]);res.json({ok:true,grupo:g[0],alumnos});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cargar el grupo.'});}
};

exports.entregarEnlace = async (req,res) => {
  if(!requireRoles(req,res,[2])) return;
  const {enlace_google_docs,comentario}=req.body;
  if(!/^https:\/\/(docs|drive)\.google\.com\//i.test(String(enlace_google_docs||''))) return res.status(400).json({ok:false,mensaje:'Ingresa un enlace válido de Google Docs/Drive.'});
  try{const [est]=await db.query('SELECT * FROM estadias WHERE id_estudiante=? ORDER BY creada_en DESC LIMIT 1',[req.usuario.id_usuario]);if(!est.length)return res.status(400).json({ok:false,mensaje:'No tienes estadía registrada.'});const [fecha]=await db.query('SELECT * FROM fechas_avances_estadia WHERE id_fecha_avance=? AND id_grupo=?',[req.params.idFecha,est[0].id_grupo]);if(!fecha.length)return res.status(404).json({ok:false,mensaje:'Entrega no encontrada.'});if(new Date()>new Date(fecha[0].fecha_limite))return res.status(400).json({ok:false,mensaje:'La entrega ya cerró.'});const [prev]=await db.query('SELECT COALESCE(MAX(version),0) max_version FROM entregas_avances_estadia WHERE id_estadia=? AND id_fecha_avance=?',[est[0].id_estadia,req.params.idFecha]);const version=Number(prev[0].max_version||0)+1;await db.query(`INSERT INTO entregas_avances_estadia(id_estadia,id_fecha_avance,version,ruta_archivo,enlace_google_docs,comentario_estudiante,comentario_actualizado_en,estado,es_tardia) VALUES(?,?,?,NULL,?,?,CURRENT_TIMESTAMP,'entregado',FALSE)`,[est[0].id_estadia,req.params.idFecha,version,enlace_google_docs,comentario||null]);res.json({ok:true,version});}
  catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo guardar la entrega.'});}
};

exports.subirMemoriaFinal = async (req,res) => {
  if(!requireRoles(req,res,[2])) return;
  if(!req.file || req.file.mimetype!=='application/pdf') return res.status(400).json({ok:false,mensaje:'La memoria final debe ser PDF.'});
  try{const [rows]=await db.query(`SELECT es.id_estadia,es.memoria_final_habilitada,g.nombre grupo,u.nombre,u.apellido FROM estadias es JOIN grupos_estadia g ON g.id_grupo=es.id_grupo JOIN usuarios u ON u.id_usuario=es.id_estudiante WHERE es.id_estudiante=? ORDER BY es.creada_en DESC LIMIT 1`,[req.usuario.id_usuario]);if(!rows.length)return res.status(400).json({ok:false,mensaje:'No tienes estadía registrada.'});const e=rows[0];if(!e.memoria_final_habilitada)return res.status(400).json({ok:false,mensaje:'Tu profesor todavía no ha marcado la memoria como terminada.'});const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'');const esperado=`${normal(e.grupo)}_${normal(`${e.nombre}${e.apellido}`)}.pdf`.toLowerCase();const recibido=normal(req.file.originalname.replace(/\.pdf$/i,'')).toLowerCase()+'.pdf';if(recibido!==esperado)return res.status(400).json({ok:false,mensaje:`El archivo debe llamarse ${normal(e.grupo)}_${normal(`${e.nombre}${e.apellido}`)}.pdf`});await db.query('UPDATE estadias SET memoria_final_ruta=?,memoria_final_nombre=?,memoria_final_mime=?,memoria_final_subida_en=CURRENT_TIMESTAMP WHERE id_estadia=?',[filePath(req.file),req.file.originalname,req.file.mimetype,e.id_estadia]);await recalcularExpediente(e.id_estadia);res.json({ok:true});}
  catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo guardar la memoria final.'});}
};

exports.autorizarMemoriaFinal = async (req,res) => {
  if(!requireRoles(req,res,[4])) return;
  try{const [rows]=await db.query('SELECT id_estadia FROM estadias WHERE id_estadia=? AND id_profesor=?',[req.params.idEstadia,req.usuario.id_usuario]);if(!rows.length)return res.status(403).json({ok:false,mensaje:'No puedes habilitar esta memoria.'});await db.query('UPDATE estadias SET memoria_final_habilitada=TRUE,memoria_final_autorizada_por=?,memoria_final_autorizada_en=CURRENT_TIMESTAMP WHERE id_estadia=?',[req.usuario.id_usuario,req.params.idEstadia]);res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo habilitar la entrega final.'});}
};

// Overrides V6 sobre comportamientos V5.
exports.guardarFechasGrupo = async (req,res) => {
  if (!requireRoles(req,res,[1])) return;
  try {
    for(const f of req.body.fechas||[]){
      await db.query(`INSERT INTO fechas_avances_estadia (id_grupo,numero_avance,titulo,fecha_apertura,fecha_limite,id_rubrica,permite_reentrega)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT (id_grupo,numero_avance) DO UPDATE SET titulo=EXCLUDED.titulo,fecha_apertura=EXCLUDED.fecha_apertura,fecha_limite=EXCLUDED.fecha_limite,id_rubrica=EXCLUDED.id_rubrica,permite_reentrega=EXCLUDED.permite_reentrega`,
        [req.params.id,f.numero_avance,f.titulo||`Taller ${f.numero_avance}`,f.fecha_apertura||null,f.fecha_limite,f.id_rubrica||null,f.permite_reentrega!==false]);
    }
    res.json({ok:true});
  } catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron guardar las fechas.'});}
};

exports.crearTaller = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const {id_periodo,nombre,descripcion,fecha_apertura,fecha_cierre,fecha_hora,modalidad,ubicacion,obligatorio,numero_entrega,id_rubrica}=req.body;
  if(!id_periodo||!nombre) return res.status(400).json({ok:false,mensaje:'Periodo y nombre son obligatorios.'});
  try {const [r]=await db.query(`INSERT INTO talleres_estadia (id_periodo,nombre,descripcion,fecha_hora,modalidad,ubicacion,obligatorio,creado_por,fecha_apertura,fecha_cierre,numero_entrega,id_rubrica) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,[id_periodo,nombre,descripcion||null,fecha_hora||fecha_cierre||null,modalidad||'presencial',ubicacion||null,obligatorio!==false,req.usuario.id_usuario,fecha_apertura||null,fecha_cierre||null,numero_entrega||null,id_rubrica||null]);
    if(numero_entrega && fecha_cierre){const [gs]=await db.query('SELECT id_grupo FROM grupos_estadia WHERE id_periodo=?',[id_periodo]);for(const g of gs) await db.query(`INSERT INTO fechas_avances_estadia(id_grupo,numero_avance,titulo,fecha_apertura,fecha_limite,id_rubrica,permite_reentrega) VALUES(?,?,?,?,?,?,TRUE) ON CONFLICT(id_grupo,numero_avance) DO UPDATE SET titulo=EXCLUDED.titulo,fecha_apertura=EXCLUDED.fecha_apertura,fecha_limite=EXCLUDED.fecha_limite,id_rubrica=EXCLUDED.id_rubrica`,[g.id_grupo,numero_entrega,nombre,fecha_apertura||null,fecha_cierre,id_rubrica||null]);}
    res.status(201).json({ok:true,id_taller:r.insertId});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo crear el taller.'});}
};

exports.registrarMiEstadia = async (req,res) => {
  if (!requireRoles(req,res,[2])) return;
  const estudiante=await estudianteByUser(req.usuario.id_usuario);
  const [ctx]=await db.query(`SELECT g.* FROM grupo_estudiantes_estadia ge JOIN grupos_estadia g ON g.id_grupo=ge.id_grupo JOIN periodos_estadia p ON p.id_periodo=g.id_periodo WHERE ge.id_estudiante=? AND p.activo=TRUE ORDER BY p.fecha_inicio DESC LIMIT 1`,[estudiante?.id_estudiante||0]);
  if(!ctx.length) return res.status(400).json({ok:false,mensaje:'Aún no tienes un grupo de estadía asignado.'});
  const c=ctx[0], b=req.body;
  if(!b.empresa_razon_social || !b.responsable_nombre || !b.proyecto_titulo) return res.status(400).json({ok:false,mensaje:'Empresa, responsable y título del proyecto son obligatorios.'});
  try{
    const [emp]=await db.query(`SELECT e.id_empresa,e.razon_social,e.rfc,e.giro,e.domicilio,e.ubicacion,u.telefono,u.correo FROM empresas e JOIN usuarios u ON u.id_usuario=e.id_empresa WHERE e.estado='habilitada' AND LOWER(TRIM(e.razon_social))=LOWER(TRIM(?)) LIMIT 1`,[b.empresa_razon_social]);
    const empresa=emp[0]||{};
    const conn=await db.getConnection();
    try{
      await conn.beginTransaction();
      const [r]=await conn.query(`INSERT INTO estadias (id_periodo,id_estudiante,id_grupo,id_profesor,id_empresa,empresa_externa,empresa_razon_social,empresa_rfc,empresa_giro,empresa_domicilio,empresa_ubicacion,empresa_telefono,empresa_correo,responsable_nombre,responsable_cargo,responsable_correo,responsable_telefono,proyecto_titulo,proyecto_problematica,proyecto_objetivo_general,proyecto_objetivos_especificos,proyecto_justificacion,proyecto_alcance,proyecto_actividades,proyecto_entregables,fecha_inicio,fecha_fin,horario_laboral,estado)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'documentacion_pendiente')
        ON CONFLICT (id_periodo,id_estudiante) DO UPDATE SET id_empresa=EXCLUDED.id_empresa,empresa_externa=EXCLUDED.empresa_externa,empresa_razon_social=EXCLUDED.empresa_razon_social,empresa_rfc=EXCLUDED.empresa_rfc,empresa_giro=EXCLUDED.empresa_giro,empresa_domicilio=EXCLUDED.empresa_domicilio,empresa_ubicacion=EXCLUDED.empresa_ubicacion,empresa_telefono=EXCLUDED.empresa_telefono,empresa_correo=EXCLUDED.empresa_correo,responsable_nombre=EXCLUDED.responsable_nombre,responsable_cargo=EXCLUDED.responsable_cargo,responsable_correo=EXCLUDED.responsable_correo,responsable_telefono=EXCLUDED.responsable_telefono,proyecto_titulo=EXCLUDED.proyecto_titulo,proyecto_problematica=EXCLUDED.proyecto_problematica,proyecto_objetivo_general=EXCLUDED.proyecto_objetivo_general,proyecto_objetivos_especificos=EXCLUDED.proyecto_objetivos_especificos,proyecto_justificacion=EXCLUDED.proyecto_justificacion,proyecto_alcance=EXCLUDED.proyecto_alcance,proyecto_actividades=EXCLUDED.proyecto_actividades,proyecto_entregables=EXCLUDED.proyecto_entregables,fecha_inicio=EXCLUDED.fecha_inicio,fecha_fin=EXCLUDED.fecha_fin,horario_laboral=EXCLUDED.horario_laboral,actualizada_en=CURRENT_TIMESTAMP RETURNING id_estadia`,
        [c.id_periodo,estudiante.id_estudiante,c.id_grupo,c.id_profesor,empresa.id_empresa||null,!empresa.id_empresa,b.empresa_razon_social,empresa.rfc||null,empresa.giro||null,empresa.domicilio||null,empresa.ubicacion||null,empresa.telefono||null,empresa.correo||null,b.responsable_nombre,b.responsable_cargo||null,b.responsable_correo||null,b.responsable_telefono||null,b.proyecto_titulo,b.proyecto_problematica||null,b.proyecto_objetivo_general||null,b.proyecto_objetivos_especificos||null,b.proyecto_justificacion||null,b.proyecto_alcance||null,b.proyecto_actividades||null,b.proyecto_entregables||null,b.fecha_inicio||null,b.fecha_fin||null,b.horario_laboral||null]);
      const idEstadia=r.rows?.[0]?.id_estadia||r.insertId;
      const [ex]=await conn.query('SELECT id_expediente FROM expedientes_estadia WHERE id_estadia=?',[idEstadia]);
      if(!ex.length) await conn.query('INSERT INTO expedientes_estadia(id_estadia,folio,estado,porcentaje_completo) VALUES(?,?,?,?)',[idEstadia,folioExpediente(idEstadia),'incompleto',20]);
      await conn.commit();res.json({ok:true,id_estadia:idEstadia,empresa_en_directorio:Boolean(empresa.id_empresa)});
    }catch(e){await conn.rollback();throw e;}finally{conn.release();}
  }catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo registrar la estadía.'});}
};


exports.actualizarTutorGrupo = async (req,res) => {
  if(!requireRoles(req,res,[1])) return;
  const idProfesor=Number(req.body.id_profesor);
  try{const [g]=await db.query('SELECT id_periodo,id_carrera FROM grupos_estadia WHERE id_grupo=?',[req.params.id]);if(!g.length)return res.status(404).json({ok:false,mensaje:'Grupo no encontrado.'});const [p]=await db.query('SELECT id_profesor FROM profesores WHERE id_profesor=? AND tutor_estadia=TRUE AND id_carrera=?',[idProfesor,g[0].id_carrera]);if(!p.length)return res.status(400).json({ok:false,mensaje:'El profesor debe ser tutor activo de la misma carrera.'});const [used]=await db.query('SELECT id_grupo FROM grupos_estadia WHERE id_periodo=? AND id_profesor=? AND id_grupo<>?',[g[0].id_periodo,idProfesor,req.params.id]);if(used.length)return res.status(400).json({ok:false,mensaje:'Ese profesor ya tiene un grupo en este periodo.'});await db.query('UPDATE grupos_estadia SET id_profesor=? WHERE id_grupo=?',[idProfesor,req.params.id]);await db.query('UPDATE estadias SET id_profesor=? WHERE id_grupo=?',[idProfesor,req.params.id]);res.json({ok:true});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cambiar el tutor.'});}
};

exports.detalleAlumnoServicios = async (req,res) => {
  if(!requireRoles(req,res,[1,6])) return;
  try{
    const [rows]=await db.query(`SELECT e.*,u.nombre,u.apellido,u.correo,u.telefono,u.foto_perfil,u.estado estado_usuario,u.fecha_registro,ge.nombre grupo_escolar,ge.generacion,c.nombre carrera_catalogo FROM estudiantes e JOIN usuarios u ON u.id_usuario=e.id_estudiante LEFT JOIN grupos_escolares ge ON ge.id_grupo_escolar=e.id_grupo_escolar LEFT JOIN carreras c ON c.id_carrera=ge.id_carrera WHERE e.id_estudiante=? LIMIT 1`,[req.params.id]);
    if(!rows.length)return res.status(404).json({ok:false,mensaje:'Alumno no encontrado.'});
    const [proyectos]=await db.query('SELECT id_proyecto,titulo,descripcion,estado,fecha_registro,tecnologias FROM proyectos WHERE id_estudiante=? ORDER BY fecha_registro DESC',[req.params.id]);
    const [postulaciones]=await db.query(`SELECT po.*,v.titulo vacante,em.razon_social empresa FROM postulaciones po JOIN vacantes v ON v.id_vacante=po.id_vacante JOIN empresas em ON em.id_empresa=v.id_empresa WHERE po.id_estudiante=? ORDER BY po.fecha_postulacion DESC`,[req.params.id]);
    const [soft]=await db.query('SELECT * FROM soft_skills_resultados WHERE id_estudiante=? ORDER BY fecha_realizacion DESC,id_resultado DESC LIMIT 1',[req.params.id]);
    const [estadia]=await db.query(`SELECT es.*,pe.nombre periodo_nombre,g.nombre grupo_estadia,CONCAT(up.nombre,' ',up.apellido) profesor_nombre FROM estadias es JOIN periodos_estadia pe ON pe.id_periodo=es.id_periodo JOIN grupos_estadia g ON g.id_grupo=es.id_grupo JOIN usuarios up ON up.id_usuario=es.id_profesor WHERE es.id_estudiante=? ORDER BY es.creada_en DESC LIMIT 1`,[req.params.id]);
    res.json({ok:true,alumno:rows[0],proyectos,postulaciones,softSkills:soft[0]||null,estadia:estadia[0]||null});
  }catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo cargar la información completa del alumno.'});}
};
