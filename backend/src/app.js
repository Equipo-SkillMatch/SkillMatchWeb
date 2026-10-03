const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const multer = require('multer');

const authRoutes = require('./routes/authRoutes');
const estudianteRoutes = require('./routes/estudianteRoutes');
const publicRoutes = require('./routes/publicRoutes');
const vacantesRoutes = require('./routes/vacantesRoutes');
const profesorRoutes = require('./routes/profesorRoutes');
const estadiaRoutes = require('./routes/estadiaRoutes');

const app = express();
const isDevelopment = app.get('env') === 'development';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'upgrade-insecure-requests': isDevelopment ? null : [],
      },
    },

    strictTransportSecurity: isDevelopment
      ? false
      : {
        maxAge: 31536000,
        includeSubDomains: true,
      },

    crossOriginResourcePolicy: {
      // El frontend y la API pueden vivir en dominios distintos (p. ej. Vercel + Render).
      // Las imagenes/videos publicos necesitan poder cargarse cross-origin.
      policy: 'cross-origin',
    },
  })
);
const envOrigins = (process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  ...envOrigins,
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin no permitido por CORS: ${origin}`));
  },
}));
app.use(express.json());

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.send('API SkillMatch funcionando');
});

app.use('/api/auth', authRoutes);
app.use('/api/estudiante', estudianteRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/vacantes', vacantesRoutes);
app.use('/api/admin', require('./routes/adminRoutes'));

app.use('/api/profesor', profesorRoutes);
app.use('/api/estadias', estadiaRoutes);

app.use((err, _req, res, _next) => {
  // Manejo de errores de validación de archivos (Multer o formato)
  if (err instanceof multer.MulterError || err?.message?.startsWith('Formato no permitido.')) {
    return res.status(400).json({
      ok: false,
      mensaje: err.message
    });
  }

  // Solo imprimir en consola si es un error no controlado (500)
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled API error:', err.message);
  }

  return res.status(500).json({
    ok: false,
    mensaje: 'Error interno del servidor'
  });
});

module.exports = app;