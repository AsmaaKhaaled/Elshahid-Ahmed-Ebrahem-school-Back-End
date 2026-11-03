import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
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
 * Validates full standard JWT, fetches fresh user from DB, and attaches req.user to request.
 * Blocks restricted temporary tokens from accessing regular protected routes.
 */
export const verifyToken = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (decoded.isTemp) {
      return next(
        AppError.forbidden('Temporary token not authorized for standard access. Please set your initial password first.')
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        nationalId: true,
        studentCode: true,
        role: true,
        status: true,
        permissions: true,
        forcePasswordChange: true,
        studentProfile: {
          select: {
            id: true,
            classId: true,
          },
        },
        teacherProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return next(AppError.unauthorized('الحساب غير موجود'));
    }

    if (user.status !== 'ACTIVE') {
      return next(AppError.forbidden('تم تجميد أو تعطيل هذا الحساب. يرجى التواصل مع إدارة النظام.'));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(
        AppError.unauthorized(
          error.name === 'TokenExpiredError' ? 'انتهت صلاحية جلسة الدخول' : 'رمز المصادقة غير صالح'
        )
      );
    }
    next(error);
  }
};

/**
 * Role-Based Access Control Middleware
 * Checks if authenticated user has one of allowed roles
 * @param {string[]} allowedRoles
 */
export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('يجب تسجيل الدخول أولاً'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('غير مصرح لك بالوصول لهذا القسم'));
    }

    next();
  };
};

/**
 * Super Admin Gatekeeper Middleware
 * Exclusively grants access to SUPER_ADMIN role (School Director / Supreme System Admin).
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(AppError.unauthorized('يجب تسجيل الدخول أولاً'));
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return next(AppError.forbidden('هذا القسم مخصص لمدير النظام الأعلى (Super Admin) فقط'));
  }

  next();
};

/**
 * Permission Check Middleware
 * - SUPER_ADMIN: Bypasses all permission checks (unconditional access).
 * - ADMIN: Checks whether req.user.permissions includes requiredPermission.
 * - Other roles: Blocked with 403 Forbidden.
 *
 * @param {string} requiredPermission
 */
export const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('يجب تسجيل الدخول أولاً'));
    }

    // 1. SUPER_ADMIN bypasses all permission checks
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // 2. ADMIN role: verify permission
    if (req.user.role === 'ADMIN') {
      const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (userPermissions.includes(requiredPermission)) {
        return next();
      }

      return next(AppError.forbidden('ليس لديك الصلاحية المطلوبة للوصول لهذا القسم'));
    }

    // 3. Any other role attempting admin-level permission check
    return next(AppError.forbidden('ليس لديك الصلاحية المطلوبة للوصول لهذا القسم'));
  };
};

/**
 * Temporary Token Verification Middleware
 * Validates temporary JWT specifically for /set-initial-password.
 * Rejects standard tokens or expired/invalid temporary tokens.
 */
export const verifyTempToken = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!decoded.isTemp) {
      return next(
        AppError.forbidden('Invalid token type: temporary token required to set initial password')
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return next(AppError.unauthorized('الحساب غير موجود'));
    }

    if (user.status !== 'ACTIVE') {
      return next(AppError.forbidden('تم تجميد أو تعطيل هذا الحساب'));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(
        AppError.unauthorized(
          error.name === 'TokenExpiredError' ? 'انتهت صلاحية الرمز المؤقت' : 'رمز المصادقة غير صالح'
        )
      );
    }
    next(error);
  }
};

// Backward-compatible alias for existing modules
export const authenticate = verifyToken;

export default {
  verifyToken,
  requireRoles,
  requireSuperAdmin,
  checkPermission,
  verifyTempToken,
  authenticate,
};
