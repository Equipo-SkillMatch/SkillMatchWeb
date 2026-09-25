const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const crypto = require('crypto');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

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

const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const storage = multer.memoryStorage();

const uploadEvidencias = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file || allowedMimeTypes.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Formato no permitido. Usa PDF, Office, TXT, ZIP, JPG, PNG, WEBP, MP4, WEBM o MOV.'));
  },
});

function getFolderByMime(mime = '') {
  if (mime.startsWith('image/')) return 'horarios-imagenes';
  if (mime.startsWith('video/')) return 'videos';
  if (mime.includes('pdf')) return 'pdfs';
  return 'archivos';
}

function saveLocalFile(reqFile) {
  const folder = getFolderByMime(reqFile.mimetype);
  const uploadDir = path.join(__dirname, '../../uploads/evidencias', folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const ext = path.extname(reqFile.originalname || '') || '';
  const safeExt = ext.toLowerCase().slice(0, 12);
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
  const fullPath = path.join(uploadDir, filename);
  fs.writeFileSync(fullPath, reqFile.buffer);

  reqFile.path = `evidencias/${folder}/${filename}`;
  reqFile.secure_url = reqFile.path;
}

const procesarYSubirACloudinary = (req, res, next) => {
  if (!req.file) return next();

  try {
    req.file.hash_archivo = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    if (!hasCloudinaryConfig) {
      saveLocalFile(req.file);
      return next();
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'skillmatch/evidencias',
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return next(error);
        req.file.path = result.secure_url;
        req.file.secure_url = result.secure_url;
        next();
      }
    );

    const readableStream = new Readable();
    readableStream.push(req.file.buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadEvidencias, procesarYSubirACloudinary };
