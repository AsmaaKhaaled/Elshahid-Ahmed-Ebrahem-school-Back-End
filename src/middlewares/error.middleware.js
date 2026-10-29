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
    success: false,
    statusCode,
    message,
    ...(details && { errors: details }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default {
  notFoundHandler,
  errorHandler,
};

