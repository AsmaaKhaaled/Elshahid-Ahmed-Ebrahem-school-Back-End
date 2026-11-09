import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';

// Memory storage keeps file buffer in memory
const storage = multer.memoryStorage();

// Allowed file extensions for spreadsheets
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      AppError.badRequest(
        `صيغة الملف غير مدعومة (${ext}). يرجى رفع ملف إكسيل بصيغة .xlsx أو .xls أو .csv`
      ),
      false
    );
  }
};

export const uploadExcelMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB Max
  },
  fileFilter,
}).single('file');

// ---- Teaching documents (curricula...) kept on disk ----

export const MAX_DOCUMENT_MB = 20;
// Same list as the frontend's FILE_ACCEPT; no video / audio (they can't be stored & streamed yet)
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip'];

/**
 * One file (field "file") saved under uploads/<folder>/ with a random name; req.file.originalname
 * keeps the real (Arabic) name. Optional: a request without a file goes through.
 */
export const uploadDocument = (folder) => {
  const dir = path.join(env.UPLOAD_DIR, folder);
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir));
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
      },
    }),
    // Arabic file names arrive as UTF-8
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_DOCUMENT_MB * 1024 * 1024, files: 1, fields: 20 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (DOCUMENT_EXTENSIONS.includes(ext)) return cb(null, true);
      cb(AppError.badRequest(`صيغة الملف غير مدعومة (${ext || 'بدون امتداد'})`), false);
    },
  }).single('file');

  return (req, res, next) =>
    upload(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? `حجم الملف أكبر من ${MAX_DOCUMENT_MB} ميجا`
            : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
              ? 'ارفع ملفًا واحدًا فقط في المرة'
              : 'تعذر رفع الملف';
        return next(AppError.badRequest(message));
      }
      next(error);
    });
};

export default uploadExcelMiddleware;

