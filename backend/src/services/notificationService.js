const db = require('../config/db');
const { getEmailStatus, sendEmail, cleanList } = require('./emailService');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function messageHtml({ mensaje, enlace, documento }) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;background:#f5f7fb;padding:24px">
    <div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
      <div style="background:#0f3b77;color:#fff;padding:20px 24px"><strong style="font-size:20px">SkillMatch · Estadías</strong></div>
      <div style="padding:24px">
        <p>${esc(mensaje || 'Se comparte una actualización del proceso de estadía.').replace(/\n/g,'<br>')}</p>
        ${documento ? `<p><b>Documento:</b> ${esc(String(documento).replace(/_/g,' '))}</p>` : ''}
        ${enlace ? `<p><a href="${esc(enlace)}" style="display:inline-block;background:#0f3b77;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px">Abrir en SkillMatch</a></p>` : ''}
        <p style="color:#64748b;font-size:13px">Este mensaje fue generado por el módulo institucional de Estadías de SkillMatch.</p>
      </div>
    </div>
  </body></html>`;
}

async function emailsByRole(idRol) {
  const [rows] = await db.query("SELECT correo FROM usuarios WHERE id_rol=? AND estado='activo' AND correo IS NOT NULL", [idRol]);
  return rows.map(r => r.correo).filter(Boolean);
}

async function resolveRecipients(idEstadia, raw) {
  const tokens = String(raw || '').split(/[;,]/).map(v => v.trim()).filter(Boolean);
  const direct = tokens.filter(v => v.includes('@'));
  const symbols = tokens.filter(v => !v.includes('@')).map(v => v.toLowerCase());
  if (!symbols.length || !idEstadia) return cleanList(direct.join(','));

  const [rows] = await db.query(`SELECT e.id_estadia,e.responsable_correo,e.asesor_org_correo,e.contacto_carta_correo,e.empresa_correo,
      ua.correo alumno_correo,up.correo asesor_correo,ue.correo empresa_cuenta_correo
    FROM estadias e JOIN usuarios ua ON ua.id_usuario=e.id_estudiante JOIN usuarios up ON up.id_usuario=e.id_profesor
    LEFT JOIN usuarios ue ON ue.id_usuario=e.id_empresa WHERE e.id_estadia=? LIMIT 1`, [idEstadia]);
  const est = rows[0] || {};
  const resolved = [...direct];

  for (const symbol of symbols) {
    if (['alumno','estudiante'].includes(symbol) && est.alumno_correo) resolved.push(est.alumno_correo);
    else if (['asesor','profesor','tutor'].includes(symbol) && est.asesor_correo) resolved.push(est.asesor_correo);
    else if (symbol === 'empresa') {
      const email = est.contacto_carta_correo || est.asesor_org_correo || est.responsable_correo || est.empresa_correo || est.empresa_cuenta_correo;
      if (email) resolved.push(email);
    } else if (['servicios_escolares','control_escolar'].includes(symbol)) resolved.push(...await emailsByRole(6));
    else if (symbol === 'biblioteca') resolved.push(...await emailsByRole(7));
    else if (['laboratorios','laboratorio'].includes(symbol)) resolved.push(...await emailsByRole(8));
    else if (['centro_idiomas','idiomas'].includes(symbol)) resolved.push(...await emailsByRole(9));
    else if (symbol === 'vinculacion') resolved.push(...await emailsByRole(5));
    else if (['direccion','super_administrador','superadmin'].includes(symbol)) resolved.push(...await emailsByRole(1));
  }
  return [...new Set(resolved.map(v => String(v).trim()).filter(Boolean))].join(', ');
}

async function createNotification({ idEstadia, tipo, para, cc, asunto, mensaje, documento, enlace, creadoPor, autoSend = false }) {
  const emailStatus = getEmailStatus();
  const contexto = { mensaje: mensaje || '', documento: documento || null, cc: cc || '', enlace: enlace || '', creado_por: creadoPor || null };
  const initialState = emailStatus.configured ? 'listo' : 'pendiente_configuracion';
  const [insert] = await db.query(`INSERT INTO eventos_notificacion_estadia(id_estadia,tipo,destinatarios,asunto,contexto,estado)
    VALUES(?,?,?,?,?::jsonb,?) RETURNING id_evento`, [idEstadia || null, tipo || 'CORREO_MANUAL', para || '', asunto || 'Notificación de estadía', JSON.stringify(contexto), initialState]);
  const idEvento = insert.rows?.[0]?.id_evento || insert.insertId;
  if (autoSend && emailStatus.configured) return sendNotificationById(idEvento);
  return { id_evento: idEvento, estado: initialState, configurado: emailStatus.configured, provider: emailStatus.provider };
}

async function sendNotificationById(idEvento) {
  const [rows] = await db.query('SELECT * FROM eventos_notificacion_estadia WHERE id_evento=? LIMIT 1', [idEvento]);
  if (!rows.length) throw new Error('Notificación no encontrada.');
  const event = rows[0];
  const context = typeof event.contexto === 'string' ? JSON.parse(event.contexto || '{}') : (event.contexto || {});
  const to = await resolveRecipients(event.id_estadia, event.destinatarios);
  const cc = await resolveRecipients(event.id_estadia, context.cc || '');
  if (!to) throw new Error('No se pudieron resolver destinatarios de correo para esta notificación.');
  try {
    const result = await sendEmail({
      to,
      cc,
      subject: event.asunto,
      text: context.mensaje || '',
      html: messageHtml({ mensaje: context.mensaje, enlace: context.enlace, documento: context.documento })
    });
    await db.query(`UPDATE eventos_notificacion_estadia SET estado='enviado',enviado_en=CURRENT_TIMESTAMP,
      destinatarios=?,contexto=COALESCE(contexto,'{}'::jsonb) || ?::jsonb WHERE id_evento=?`, [to, JSON.stringify({ destinatarios_resueltos: to, proveedor: result.provider, proveedor_id: result.id || null, error: null }), idEvento]);
    return { ok: true, id_evento: idEvento, estado: 'enviado', destinatarios: to, ...result };
  } catch (error) {
    await db.query(`UPDATE eventos_notificacion_estadia SET estado='error',contexto=COALESCE(contexto,'{}'::jsonb) || ?::jsonb WHERE id_evento=?`, [JSON.stringify({ error: error.message }), idEvento]);
    throw error;
  }
}

async function processPendingNotifications(limit = 20) {
  const status = getEmailStatus();
  if (!status.configured) return { processed: 0, sent: 0, errors: 0, configured: false };
  const [rows] = await db.query(`SELECT id_evento FROM eventos_notificacion_estadia
    WHERE estado IN ('pendiente_configuracion','listo','error') ORDER BY creado_en ASC LIMIT ?`, [Math.max(1, Math.min(100, Number(limit) || 20))]);
  let sent = 0, errors = 0;
  for (const row of rows) {
    try { await sendNotificationById(row.id_evento); sent++; }
    catch (_e) { errors++; }
  }
  return { processed: rows.length, sent, errors, configured: true, provider: status.provider };
}

module.exports = { createNotification, sendNotificationById, processPendingNotifications, getEmailStatus, resolveRecipients };
