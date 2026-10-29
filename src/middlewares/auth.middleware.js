import { AppError } from '../shared/errors/app-error.js';
import { verifyAccessToken } from '../shared/utils/token.util.js';

/**
 * Authentication Middleware
 * Validates JWT in Authorization: Bearer <token>
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Invalid authorization header format');
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, email, role, ... }
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(error);
    } else {
      next(error);
    }
  }
};

export default authenticate;

