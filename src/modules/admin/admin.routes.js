import { Router } from 'express';
import { AdminController } from './admin.controller.js';
import { adminValidation } from './admin.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, requireSuperAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * Super Admin Exclusive Gate:
 * All routes here require valid JWT and role === 'SUPER_ADMIN'
 */
router.use(verifyToken, requireSuperAdmin);

// List all admins and create new admin
router.get(['/admins', '/'], AdminController.getAllAdmins);
router.post(['/admins', '/'], validate(adminValidation.createAdmin), AdminController.createAdmin);

// Single admin detail, permissions, status, password reset, deletion
router.get(['/admins/:id', '/:id'], AdminController.getAdminById);
router.patch(
  ['/admins/:id/permissions', '/:id/permissions'],
  validate(adminValidation.updatePermissions),
  AdminController.updatePermissions
);
router.patch(
  ['/admins/:id/status', '/:id/status'],
  validate(adminValidation.updateStatus),
  AdminController.updateStatus
);
router.patch(
  ['/admins/:id/reset-password', '/:id/reset-password'],
  validate(adminValidation.resetPassword),
  AdminController.resetPassword
);
router.delete(['/admins/:id', '/:id'], AdminController.deleteAdmin);

export default router;

