import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';

/**
 * Extracts Bearer token from Authorization header.
 * @param {import('express').Request} req
 * @returns {string} token
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('No authentication token provided');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw AppError.unauthorized('Invalid authorization header format');
  }

  return token;
};

/**
 * Standard Token Verification Middleware
 * Validates full standard JWT and attaches req.user to request.
 * Blocks restricted temporary tokens from accessing regular protected routes.
 */
export const verifyToken = (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (decoded.isTemp) {
      throw AppError.forbidden('Temporary token not authorized for standard access. Please set your initial password first.');
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(error);
    } else {
      next(error);
    }
  }
};

/**
 * Temporary Token Verification Middleware
 * Validates temporary JWT specifically for /set-initial-password.
 * Rejects standard tokens or expired/invalid temporary tokens.
 */
export const verifyTempToken = (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!decoded.isTemp) {
      throw AppError.forbidden('Invalid token type: temporary token required to set initial password');
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(error);
    } else {
      next(error);
    }
  }
};

// Backward-compatible alias for existing modules
export const authenticate = verifyToken;

export default {
  verifyToken,
  verifyTempToken,
  authenticate,
};
