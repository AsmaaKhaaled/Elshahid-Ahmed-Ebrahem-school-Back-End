import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';
import { ApiResponse } from '../shared/utils/api-response.js';

/**
 * Handle 404 Route Not Found
 */
export const notFoundHandler = (req, res, next) => {
  next(AppError.notFound(`Cannot find ${req.method} ${req.originalUrl} on this server`));
};

/**
 * Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Handle JWT errors specifically
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  // Prisma errors a request can cause (not server faults)
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'البيانات دي مسجلة بالفعل لسجل آخر (قيمة مكررة)';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'السجل المطلوب غير موجود';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'السجل مرتبط بسجل آخر غير موجود';
    }
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'بيانات غير صالحة';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الملف أكبر من المسموح' : 'تعذر رفع الملف، تأكد من اختيار ملف واحد في خانة file';
  }

  // Handle syntax errors in JSON body parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  // Log server errors (5xx)
  if (statusCode >= 500) {
    console.error('[Error] Server Error:', err);
  }

  return res.status(statusCode).json({
    status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
    success: false,
    statusCode,
    message,
    ...(err.code && { code: err.code }),
    ...(err.conflict && { conflict: err.conflict }),
    ...(details && { errors: details }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default {
  notFoundHandler,
  errorHandler,
};

