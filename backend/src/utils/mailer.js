const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const GOOGLE_MAIL = process.env.GOOGLE_MAIL; 
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const createTransporter = async () => {
  try {
    const oauth2Client = new OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      "https://developers.google.com/oauthplayground"
    );

    // Le damos el token infinito que conseguiste
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    
    // INVOCAMOS A LA API NATIVA DE GMAIL
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Devolvemos un objeto que "simula" ser Nodemailer para que tu controlador funcione igual
    return {
      sendMail: async (mailOptions) => {
        // Armamos el esqueleto del correo (RFC 2822 format)
        const utf8Subject = `=?utf-8?B?${Buffer.from(mailOptions.subject).toString('base64')}?=`;
        const messageParts = [
          `From: ${mailOptions.from}`,
          `To: ${mailOptions.to}`,
          ...(mailOptions.cc ? [`Cc: ${mailOptions.cc}`] : []),
          ...(mailOptions.replyTo ? [`Reply-To: ${mailOptions.replyTo}`] : []),
          `Subject: ${utf8Subject}`,
          `Content-Type: text/html; charset=utf-8`,
          `MIME-Version: 1.0`,
          '', // Línea vacía requerida antes del contenido
          mailOptions.html
        ];
        
        const message = messageParts.join('\n');

        // La API de Google exige que el texto esté codificado en Base64 seguro para URL
        const encodedMessage = Buffer.from(message)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // ¡Disparo HTTP por el puerto 443! (Imbloqueable por Render)
        const res = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encodedMessage }
        });
        
        return res.data;
      }
    };
  } catch (error) {
    console.error("❌ Error creando el servicio de Gmail API:", error);
    throw error;
  }
};

module.exports = createTransporter;