/**
 * Custom AppError for centralized, predictable HTTP error handling.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = null) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'Unauthorized access', details = null) {
    return new AppError(message, 401, details);
  }

  static forbidden(message = 'Forbidden access', details = null) {
    return new AppError(message, 403, details);
  }

  static notFound(message = 'Resource not found', details = null) {
    return new AppError(message, 404, details);
  }

  static conflict(message = 'Resource already exists', details = null) {
    return new AppError(message, 409, details);
  }

  static unprocessableEntity(message = 'Validation error', details = null) {
    return new AppError(message, 422, details);
  }

  static internal(message = 'Internal Server Error', details = null) {
    return new AppError(message, 500, details);
  }
}

export default AppError;

