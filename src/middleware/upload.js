const fs = require('fs');
const path = require('path');
const multer = require('multer');

const galleryDir = path.join(__dirname, '../../uploads/gallery');
fs.mkdirSync(galleryDir, { recursive: true });

const allowed = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, galleryDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
  },
});

const galleryUpload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('Use jpg, png, webp, gif, mp4, webm, or mov files.'));
  },
});

module.exports = { galleryUpload, galleryDir };
