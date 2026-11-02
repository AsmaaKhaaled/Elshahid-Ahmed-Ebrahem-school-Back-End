import multer from 'multer';
import path from 'path';
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

export default uploadExcelMiddleware;

