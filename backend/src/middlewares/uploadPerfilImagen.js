const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const hasCloudinaryConfig =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
  Boolean(process.env.CLOUDINARY_API_KEY) &&
  Boolean(process.env.CLOUDINARY_API_SECRET);

if (hasCloudinaryConfig) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

let storage;
if (hasCloudinaryConfig) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: (req) => ({
      folder: 'skillmatch/perfiles',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: `perfil-${req.usuario?.id_usuario || 'usuario'}-${Date.now()}`,
      transformation: [{ width: 900, height: 900, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    }),
  });
} else {
  const uploadDir = path.join(__dirname, '../../uploads/perfiles');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const idUsuario = req.usuario?.id_usuario || 'usuario';
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `perfil-${idUsuario}-${unique}${ext}`);
    },
  });
}

const uploadPerfilImagen = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (file && allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Formato de foto no permitido. Usa JPG, PNG o WEBP.'));
  },
});

module.exports = uploadPerfilImagen;
