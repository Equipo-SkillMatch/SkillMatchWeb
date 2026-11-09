const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const createGmailTransporter = require('../utils/mailer');

function cleanList(value) {
  return String(value || '')
    .split(/[;,]/)
    .map(v => v.trim())
    .filter(Boolean)
    .join(', ');
}

function providerName() {
  return String(process.env.MAIL_PROVIDER || 'disabled').trim().toLowerCase();
}

function getEmailStatus() {
  const provider = providerName();
  const from = process.env.MAIL_FROM || process.env.GOOGLE_MAIL || process.env.SMTP_USER || '';
  const status = { provider, from, configured: false, missing: [] };

  if (provider === 'disabled' || provider === 'none' || !provider) {
    status.missing = ['MAIL_PROVIDER'];
    return status;
  }

  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) status.missing.push('RESEND_API_KEY');
    if (!from) status.missing.push('MAIL_FROM');
  } else if (provider === 'gmail') {
    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']) {
      if (!process.env[key]) status.missing.push(key);
    }
    if (!process.env.GOOGLE_MAIL && !process.env.MAIL_FROM) status.missing.push('GOOGLE_MAIL o MAIL_FROM');
  } else if (provider === 'smtp') {
    for (const key of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
      if (!process.env[key]) status.missing.push(key);
    }
    if (!from) status.missing.push('MAIL_FROM');
  } else {
    status.missing.push(`MAIL_PROVIDER no soportado: ${provider}`);
  }

  status.configured = status.missing.length === 0;
  return status;
}

async function sendEmail({ to, cc, subject, html, text, replyTo }) {
  const status = getEmailStatus();
  if (!status.configured) {
    const error = new Error('El servicio de correo todavía no está configurado.');
    error.code = 'MAIL_NOT_CONFIGURED';
    error.details = status;
    throw error;
  }

  const mail = {
    from: status.from,
    to: cleanList(to),
    cc: cleanList(cc),
    subject: String(subject || 'Notificación SkillMatch'),
    html: html || `<p>${String(text || '').replace(/\n/g, '<br>')}</p>`,
    text: text || undefined,
    replyTo: replyTo || undefined
  };

  if (!mail.to) throw new Error('El correo no tiene destinatario.');

  if (status.provider === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: mail.from,
      to: mail.to.split(',').map(v => v.trim()).filter(Boolean),
      cc: mail.cc ? mail.cc.split(',').map(v => v.trim()).filter(Boolean) : undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      reply_to: mail.replyTo
    });
    if (result.error) throw new Error(result.error.message || 'Resend no pudo enviar el correo.');
    return { provider: 'resend', id: result.data?.id || null };
  }

  if (status.provider === 'gmail') {
    const transporter = await createGmailTransporter();
    const result = await transporter.sendMail(mail);
    return { provider: 'gmail', id: result?.id || result?.messageId || null };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const result = await transporter.sendMail(mail);
  return { provider: 'smtp', id: result.messageId || null };
}

module.exports = { getEmailStatus, sendEmail, cleanList };
