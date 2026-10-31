import { AppError } from '../shared/errors/app-error.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} roles Allowed roles, e.g. 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('User is not authenticated'));
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(`Access forbidden: requires one of [${roles.join(', ')}] roles`)
      );
    }

    next();
  };
};

export default authorize;

