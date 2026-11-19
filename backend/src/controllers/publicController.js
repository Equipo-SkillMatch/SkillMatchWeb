const Proyecto = require('../models/Proyecto');
const db = require('../config/db');
const { isSameAsset } = require('../utils/fileUrl');

const APP_VERSION = '8.4.0-toma-protesta-3-evaluadores';

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

exports.listarGruposEscolaresPublicos = async (_req,res) => {
  try{const [rows]=await db.query(`SELECT ge.id_grupo_escolar,ge.nombre,ge.generacion,c.id_carrera,c.nombre carrera FROM grupos_escolares ge JOIN carreras c ON c.id_carrera=ge.id_carrera WHERE ge.activo=TRUE ORDER BY c.nombre,ge.generacion,ge.nombre`);res.json({ok:true,grupos:rows});}
  catch(e){res.status(500).json({ok:false,mensaje:'No se pudieron cargar los grupos escolares.'});}
};


// V7 - Evaluación de empresa mediante enlace público con token no predecible.
exports.obtenerEvaluacionEmpresaPublica = async (req,res) => {
  try{
    const token=String(req.params.token||'');
    const [rows]=await db.query(`SELECT ee.id_evaluacion_empresa,ee.momento,ee.vence_en,ee.respondida_en,
      es.proyecto_titulo,es.empresa_razon_social,u.nombre,u.apellido,e.matricula,p.nombre periodo_nombre
      FROM evaluaciones_empresa_estadia ee JOIN estadias es ON es.id_estadia=ee.id_estadia
      JOIN estudiantes e ON e.id_estudiante=es.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante
      JOIN periodos_estadia p ON p.id_periodo=es.id_periodo WHERE ee.token_publico=? LIMIT 1`,[token]);
    if(!rows.length)return res.status(404).json({ok:false,mensaje:'Enlace de evaluación no válido.'});
    if(rows[0].vence_en && new Date(rows[0].vence_en)<new Date())return res.status(410).json({ok:false,mensaje:'Este enlace de evaluación ha vencido.'});
    const [preguntas]=await db.query('SELECT * FROM preguntas_evaluacion_empresa WHERE activa=TRUE ORDER BY orden');
    const [niveles]=await db.query('SELECT * FROM niveles_evaluacion_estadia WHERE activo=TRUE ORDER BY orden');
    res.json({ok:true,evaluacion:rows[0],preguntas,niveles});
  }catch(e){console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo cargar la evaluación.'});}
};

exports.responderEvaluacionEmpresaPublica = async (req,res) => {
  const token=String(req.params.token||'');
  const respuestas=Array.isArray(req.body.respuestas)?req.body.respuestas:[];
  if(respuestas.length!==10)return res.status(400).json({ok:false,mensaje:'Debes responder las 10 preguntas.'});
  const conn=await db.getConnection();
  try{
    const [ev]=await conn.query('SELECT * FROM evaluaciones_empresa_estadia WHERE token_publico=? LIMIT 1',[token]);
    if(!ev.length)return res.status(404).json({ok:false,mensaje:'Enlace de evaluación no válido.'});
    if(ev[0].vence_en && new Date(ev[0].vence_en)<new Date())return res.status(410).json({ok:false,mensaje:'Este enlace de evaluación ha vencido.'});
    await conn.beginTransaction();
    let suma=0;
    for(const r of respuestas){
      const [q]=await conn.query('SELECT id_pregunta FROM preguntas_evaluacion_empresa WHERE id_pregunta=? AND activa=TRUE',[r.id_pregunta]);
      const [n]=await conn.query('SELECT codigo,valor FROM niveles_evaluacion_estadia WHERE codigo=? AND activo=TRUE',[String(r.codigo_nivel||'').toUpperCase()]);
      if(!q.length||!n.length)throw new Error('Respuesta inválida');
      const valor=Number(n[0].valor||0);suma+=valor;
      await conn.query(`INSERT INTO respuestas_evaluacion_empresa(id_evaluacion_empresa,id_pregunta,codigo_nivel,valor,comentario)
        VALUES(?,?,?,?,?) ON CONFLICT(id_evaluacion_empresa,id_pregunta) DO UPDATE SET codigo_nivel=EXCLUDED.codigo_nivel,valor=EXCLUDED.valor,comentario=EXCLUDED.comentario`,
        [ev[0].id_evaluacion_empresa,r.id_pregunta,n[0].codigo,valor,r.comentario||null]);
    }
    const promedio=Math.round((suma/respuestas.length)*100)/100;
    const [nearest]=await conn.query('SELECT codigo FROM niveles_evaluacion_estadia WHERE activo=TRUE ORDER BY ABS(valor-?) ASC,orden DESC LIMIT 1',[promedio]);
    await conn.query(`UPDATE evaluaciones_empresa_estadia SET respondida_en=CURRENT_TIMESTAMP,evaluador_nombre=?,evaluador_correo=?,evaluador_cargo=?,promedio=?,codigo_final=?,observaciones=? WHERE id_evaluacion_empresa=?`,
      [req.body.evaluador_nombre||null,req.body.evaluador_correo||null,req.body.evaluador_cargo||null,promedio,nearest[0]?.codigo||'NA',req.body.observaciones||null,ev[0].id_evaluacion_empresa]);
    await conn.commit();
    res.json({ok:true,promedio,codigo_final:nearest[0]?.codigo||'NA'});
  }catch(e){try{await conn.rollback();}catch{};console.error(e);res.status(500).json({ok:false,mensaje:'No se pudo guardar la evaluación.'});}
  finally{conn.release();}
};

// V8 - Aprobacion publica de memoria tecnica por empresa externa.
exports.obtenerAprobacionMemoriaEmpresa = async (req,res) => {
  try{
    const [rows]=await db.query(`SELECT v.id_validacion,v.estado,v.observaciones,v.calificacion_memoria_empresa,e.memoria_final_ruta,e.memoria_final_nombre,
      COALESCE(e.memoria_final_version,0) memoria_final_version,e.proyecto_titulo,e.empresa_razon_social,
      u.nombre,u.apellido,es.matricula,g.nombre grupo_nombre,p.nombre periodo_nombre
      FROM validaciones_cierre_estadia v JOIN estadias e ON e.id_estadia=v.id_estadia
      JOIN estudiantes es ON es.id_estudiante=e.id_estudiante JOIN usuarios u ON u.id_usuario=e.id_estudiante
      JOIN grupos_estadia g ON g.id_grupo=e.id_grupo JOIN periodos_estadia p ON p.id_periodo=e.id_periodo
      WHERE v.area='empresa_memoria' AND v.token_publico=? LIMIT 1`,[req.params.token]);
    if(!rows.length)return res.status(404).json({ok:false,mensaje:'Enlace de aprobación no válido.'});
    res.json({ok:true,solicitud:rows[0]});
  }catch(e){res.status(500).json({ok:false,mensaje:'No se pudo cargar la memoria técnica.'});}
};

exports.responderAprobacionMemoriaEmpresa = async (req,res) => {
  const estado=String(req.body.estado||'');
  const calificacion=req.body.calificacion===undefined||req.body.calificacion===null?null:Number(req.body.calificacion);
  if(!['aprobado','rechazado','requiere_correccion'].includes(estado))return res.status(400).json({ok:false,mensaje:'Estado inválido.'});
  if(estado==='aprobado' && ![8,9,10].includes(calificacion))return res.status(400).json({ok:false,mensaje:'Selecciona una calificación de 8, 9 o 10 para aprobar la memoria.'});
  if(['rechazado','requiere_correccion'].includes(estado) && !String(req.body.observaciones||'').trim())return res.status(400).json({ok:false,mensaje:'Indica el motivo o la corrección que debe realizar el alumno.'});
  try{
    const [rows]=await db.query(`SELECT id_validacion FROM validaciones_cierre_estadia WHERE area='empresa_memoria' AND token_publico=? LIMIT 1`,[req.params.token]);
    if(!rows.length)return res.status(404).json({ok:false,mensaje:'Enlace de aprobación no válido.'});
    await db.query(`UPDATE validaciones_cierre_estadia SET estado=?,observaciones=?,calificacion_memoria_empresa=?,revisado_en=CURRENT_TIMESTAMP,actualizado_en=CURRENT_TIMESTAMP WHERE id_validacion=?`,
      [estado,req.body.observaciones||null,estado==='aprobado'?calificacion:null,rows[0].id_validacion]);
    if(estado==='aprobado'){
      const [v]=await db.query('SELECT id_estadia FROM validaciones_cierre_estadia WHERE id_validacion=?',[rows[0].id_validacion]);
      if(v[0]){
        for(const area of ['biblioteca','laboratorios','direccion','vinculacion']){
          await db.query(`INSERT INTO validaciones_cierre_estadia(id_estadia,area,estado,enviado_en) VALUES(?,?,'en_revision',CURRENT_TIMESTAMP)
            ON CONFLICT(id_estadia,area) DO UPDATE SET estado=CASE WHEN validaciones_cierre_estadia.estado='aprobado' THEN 'aprobado' ELSE 'en_revision' END,enviado_en=CURRENT_TIMESTAMP,actualizado_en=CURRENT_TIMESTAMP`,[v[0].id_estadia,area]);
        }
        const [donativoInfo]=await db.query(`SELECT e.id_estadia,p.monto_donativo,p.fecha_inicio FROM estadias e JOIN periodos_estadia p ON p.id_periodo=e.id_periodo WHERE e.id_estadia=? LIMIT 1`,[v[0].id_estadia]);
        if(donativoInfo.length){
          const anio=donativoInfo[0].fecha_inicio?new Date(donativoInfo[0].fecha_inicio).getFullYear():new Date().getFullYear();
          const referencia=`DON-${anio}-${String(v[0].id_estadia).padStart(6,'0')}`;
          await db.query(`INSERT INTO validaciones_cierre_estadia(id_estadia,area,estado,enviado_en,referencia_donativo,monto_donativo)
            VALUES(?,'servicios_escolares','pendiente',CURRENT_TIMESTAMP,?,?)
            ON CONFLICT(id_estadia,area) DO UPDATE SET
              referencia_donativo=COALESCE(validaciones_cierre_estadia.referencia_donativo,EXCLUDED.referencia_donativo),
              monto_donativo=COALESCE(validaciones_cierre_estadia.monto_donativo,EXCLUDED.monto_donativo),
              actualizado_en=CURRENT_TIMESTAMP`,[v[0].id_estadia,referencia,Number(donativoInfo[0].monto_donativo||0)]);
        }
        await db.query(`INSERT INTO eventos_notificacion_estadia(id_estadia,tipo,destinatarios,asunto,contexto) VALUES(?,'MEMORIA_EMPRESA_APROBADA','biblioteca,laboratorios,vinculacion,direccion,servicios_escolares,alumno,asesor','Memoria aprobada por empresa; inicia validación institucional y donativo','{}'::jsonb)`,[v[0].id_estadia]);
      }
    }
    res.json({ok:true});
  }catch(e){res.status(500).json({ok:false,mensaje:'No se pudo registrar la aprobación.'});}
};

// V9.5 - Toma de protesta: confirmación de fecha y evaluación en enlaces separados.
exports.obtenerTomaProtestaPublica = async (req,res) => {
  try{
    const token=String(req.params.token||'');
    const [rows]=await db.query(`SELECT te.id_toma,te.id_profesor,te.orden,te.disponibilidad_estado,te.disponibilidad_observaciones,te.disponibilidad_respondida_en,
      CASE WHEN te.token_evaluacion=? THEN 'evaluacion' ELSE 'disponibilidad' END tipo_enlace,
      t.fecha_hora,t.lugar,t.estado,e.proyecto_titulo,e.empresa_razon_social,es.matricula,u.nombre,u.apellido,g.nombre grupo_nombre,p.nombre periodo_nombre,
      CONCAT(up.nombre,' ',up.apellido) evaluador_nombre,ev.calificacion promedio,ev.decision,ev.observaciones,ev.evaluado_en
      FROM toma_protesta_evaluadores te
      JOIN tomas_protesta t ON t.id_toma=te.id_toma
      JOIN estadias e ON e.id_estadia=t.id_estadia
      JOIN estudiantes es ON es.id_estudiante=e.id_estudiante
      JOIN usuarios u ON u.id_usuario=e.id_estudiante
      JOIN grupos_estadia g ON g.id_grupo=e.id_grupo
      JOIN periodos_estadia p ON p.id_periodo=e.id_periodo
      JOIN usuarios up ON up.id_usuario=te.id_profesor
      LEFT JOIN evaluaciones_toma_protesta ev ON ev.id_toma=te.id_toma AND ev.id_profesor=te.id_profesor
      WHERE te.token_publico=? OR te.token_evaluacion=? LIMIT 1`,[token,token,token]);
    if(!rows.length)return res.status(404).json({ok:false,mensaje:'Enlace de toma de protesta no válido.'});
    const item=rows[0];
    const [jurado]=await db.query(`SELECT te.orden,CONCAT(u.nombre,' ',u.apellido) nombre,te.disponibilidad_estado
      FROM toma_protesta_evaluadores te JOIN usuarios u ON u.id_usuario=te.id_profesor WHERE te.id_toma=? ORDER BY te.orden`,[item.id_toma]);
    const todosAceptaron=jurado.length===3 && jurado.every(x=>x.disponibilidad_estado==='aceptada');
    const habilitada=item.tipo_enlace==='evaluacion' && todosAceptaron && new Date(item.fecha_hora)<=new Date();
    const [preguntas]=await db.query(`SELECT id_pregunta,pregunta,orden,numero_taller FROM preguntas_toma_protesta WHERE activa=TRUE ORDER BY numero_taller,orden`);
    let respuestas=[];
    if(item.evaluado_en){
      [respuestas]=await db.query('SELECT id_pregunta,calificacion FROM respuestas_toma_protesta WHERE id_toma=? AND id_profesor=? ORDER BY id_pregunta',[item.id_toma,item.id_profesor]);
    }
    res.json({ok:true,toma:{...item,todos_aceptaron:todosAceptaron,jurado},preguntas,respuestas,habilitada});
  }catch(e){console.error('Error obtenerTomaProtestaPublica:',e);res.status(500).json({ok:false,mensaje:'No se pudo cargar la toma de protesta.'});}
};

exports.responderDisponibilidadTomaPublica = async (req,res) => {
  const token=String(req.params.token||'');
  const decision=String(req.body.decision||'');
  if(!['aceptada','rechazada'].includes(decision))return res.status(400).json({ok:false,mensaje:'Selecciona aceptar o rechazar la fecha propuesta.'});
  try{
    const [asig]=await db.query(`SELECT te.id_toma,te.id_profesor,t.id_estadia,t.fecha_hora
      FROM toma_protesta_evaluadores te JOIN tomas_protesta t ON t.id_toma=te.id_toma WHERE te.token_publico=? LIMIT 1`,[token]);
    if(!asig.length)return res.status(404).json({ok:false,mensaje:'Este enlace no corresponde a la confirmación de fecha.'});
    await db.query(`UPDATE toma_protesta_evaluadores SET disponibilidad_estado=?,disponibilidad_observaciones=?,disponibilidad_respondida_en=CURRENT_TIMESTAMP,token_evaluacion=NULL
      WHERE token_publico=?`,[decision,req.body.observaciones||null,token]);
    const [all]=await db.query('SELECT disponibilidad_estado FROM toma_protesta_evaluadores WHERE id_toma=? ORDER BY orden',[asig[0].id_toma]);
    let estado='programada';
    if(all.some(x=>x.disponibilidad_estado==='rechazada')) estado='fecha_rechazada';
    else if(all.length===3 && all.every(x=>x.disponibilidad_estado==='aceptada')) estado='fecha_confirmada';
    if(estado!=='fecha_confirmada') await db.query('UPDATE toma_protesta_evaluadores SET token_evaluacion=NULL WHERE id_toma=?',[asig[0].id_toma]);
    await db.query('UPDATE tomas_protesta SET estado=? WHERE id_toma=?',[estado,asig[0].id_toma]);
    res.json({ok:true,estado_toma:estado,todos_aceptaron:estado==='fecha_confirmada',mensaje:decision==='aceptada'?'Fecha aceptada correctamente.':'Fecha rechazada. El asesor deberá proponer una nueva fecha.'});
  }catch(e){console.error('Error responderDisponibilidadTomaPublica:',e);res.status(500).json({ok:false,mensaje:'No se pudo registrar tu respuesta de disponibilidad.'});}
};

exports.responderTomaProtestaPublica = async (req,res) => {
  const token=String(req.params.token||'');
  const respuestas=Array.isArray(req.body.respuestas)?req.body.respuestas:[];
  const decision=String(req.body.decision||'');
  if(!['aprobado','rechazado'].includes(decision))return res.status(400).json({ok:false,mensaje:'Selecciona aprobar o rechazar la toma de protesta.'});
  const conn=await db.getConnection();
  try{
    const [asig]=await conn.query(`SELECT te.id_toma,te.id_profesor,t.fecha_hora,t.id_estadia
      FROM toma_protesta_evaluadores te JOIN tomas_protesta t ON t.id_toma=te.id_toma WHERE te.token_evaluacion=? LIMIT 1`,[token]);
    if(!asig.length)return res.status(404).json({ok:false,mensaje:'El enlace de evaluación no es válido o todavía no ha sido liberado por el asesor.'});
    const [disp]=await conn.query('SELECT disponibilidad_estado FROM toma_protesta_evaluadores WHERE id_toma=? ORDER BY orden',[asig[0].id_toma]);
    if(disp.length!==3 || !disp.every(x=>x.disponibilidad_estado==='aceptada'))return res.status(400).json({ok:false,mensaje:'Los tres profesores deben aceptar la fecha antes de evaluar.'});
    if(new Date(asig[0].fecha_hora)>new Date())return res.status(400).json({ok:false,mensaje:'La evaluación se habilita al llegar la fecha y hora programadas.'});
    const [preguntas]=await conn.query('SELECT id_pregunta FROM preguntas_toma_protesta WHERE activa=TRUE ORDER BY numero_taller,orden');
    const ids=new Set(preguntas.map(q=>Number(q.id_pregunta)));
    if(!preguntas.length || respuestas.length!==preguntas.length || respuestas.some(r=>!ids.has(Number(r.id_pregunta))))
      return res.status(400).json({ok:false,mensaje:`Debes calificar los ${preguntas.length} criterios académicos de la memoria técnica.`});
    await conn.beginTransaction();
    let suma=0;
    for(const r of respuestas){
      const cal=Number(r.calificacion);
      if(!Number.isFinite(cal)||cal<0||cal>10)throw new Error('Cada calificación debe estar entre 0 y 10.');
      suma+=cal;
      await conn.query(`INSERT INTO respuestas_toma_protesta(id_toma,id_profesor,id_pregunta,calificacion)
        VALUES(?,?,?,?) ON CONFLICT(id_toma,id_profesor,id_pregunta) DO UPDATE SET calificacion=EXCLUDED.calificacion,creado_en=CURRENT_TIMESTAMP`,
        [asig[0].id_toma,asig[0].id_profesor,r.id_pregunta,cal]);
    }
    const promedio=Math.round((suma/preguntas.length)*100)/100;
    const [nivel]=await conn.query('SELECT codigo FROM niveles_evaluacion_estadia WHERE activo=TRUE ORDER BY ABS(valor-?) ASC,orden DESC LIMIT 1',[promedio]);
    await conn.query(`INSERT INTO evaluaciones_toma_protesta(id_toma,id_profesor,codigo_nivel,calificacion,observaciones,decision)
      VALUES(?,?,?,?,?,?) ON CONFLICT(id_toma,id_profesor) DO UPDATE SET codigo_nivel=EXCLUDED.codigo_nivel,calificacion=EXCLUDED.calificacion,observaciones=EXCLUDED.observaciones,decision=EXCLUDED.decision,evaluado_en=CURRENT_TIMESTAMP`,
      [asig[0].id_toma,asig[0].id_profesor,nivel[0]?.codigo||'NA',promedio,req.body.observaciones||null,decision]);

    const [evs]=await conn.query('SELECT id_profesor,calificacion,decision FROM evaluaciones_toma_protesta WHERE id_toma=?',[asig[0].id_toma]);
    if(evs.length>=3){
      const aprobado=evs.every(e=>e.decision==='aprobado');
      if(aprobado){
        await conn.query("UPDATE tomas_protesta SET estado='aprobada',finalizada_en=CURRENT_TIMESTAMP WHERE id_toma=?",[asig[0].id_toma]);
        await conn.query("UPDATE estadias SET estado='terminada',toma_protesta_aprobada=TRUE,cierre_completado_en=CURRENT_TIMESTAMP,actualizada_en=CURRENT_TIMESTAMP WHERE id_estadia=?",[asig[0].id_estadia]);
        await conn.query("UPDATE expedientes_estadia SET estado='cerrado',porcentaje_completo=100,actualizado_en=CURRENT_TIMESTAMP WHERE id_estadia=?",[asig[0].id_estadia]);
      }else{
        await conn.query("UPDATE tomas_protesta SET estado='requiere_revision' WHERE id_toma=?",[asig[0].id_toma]);
      }
    }
    await conn.commit();
    res.json({ok:true,promedio,mensaje:'Evaluación registrada correctamente.'});
  }catch(e){try{await conn.rollback();}catch{};console.error('Error responderTomaProtestaPublica:',e);res.status(500).json({ok:false,mensaje:e.message||'No se pudo guardar la evaluación.'});}
  finally{conn.release();}
};
