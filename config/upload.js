import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_BASE = path.join(__dirname, '..', 'uploads');

// Extensiones y MIME types permitidos
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.csv', '.odt', '.ods',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip', '.rar', '.7z'
]);

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream' // Fallback para algunos navegadores
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Helper para crear directorios
export const ensureUploadDir = (subpath) => {
  const dir = path.join(UPLOADS_BASE, subpath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// File filter: doble validación (extensión + MIME)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Tipo de archivo no permitido: ${ext}`));
  }
  // application/octet-stream se acepta solo si la extensión es válida
  if (file.mimetype !== 'application/octet-stream' && !ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new Error(`MIME type no permitido: ${file.mimetype}`));
  }
  cb(null, true);
};

// Storage para documentos de proyecto
const proyectoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = ensureUploadDir(`proyectos/${req.params.id}`);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  }
});

// Storage para archivos de hitos
const hitoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = ensureUploadDir(`hitos/${req.params.id}`);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  }
});

// Multer instances
const uploadProyecto = multer({
  storage: proyectoStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

const uploadHito = multer({
  storage: hitoStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

// Middleware factories con manejo de errores multer
const wrapMulter = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'El archivo excede el tamaño máximo de 10 MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, error: 'Se excedió el número máximo de archivos' });
      }
      return res.status(400).json({ success: false, error: `Error de upload: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

export const uploadProyectoMiddleware = wrapMulter(uploadProyecto.array('archivos', 10));
export const uploadHitoMiddleware = wrapMulter(uploadHito.array('archivos', 3));
export { UPLOADS_BASE };
