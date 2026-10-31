import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { loginSchema, setInitialPasswordSchema, updateProfileSchema, changePasswordSchema } from './auth.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, verifyTempToken, requireRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

// 1. Unified Login (Admin, Teacher, Student)
router.post('/login', validate(loginSchema), AuthController.login);

// 2. Set Initial Password (Protected by temporary token)
router.patch(
  '/set-initial-password',
  verifyTempToken,
  validate(setInitialPasswordSchema),
  AuthController.setInitialPassword
);

// 3. Current Authenticated User Session (Protected by standard token)
router.get('/me', verifyToken, AuthController.getMe);

// 4. Own account details - school administration only (teacher & student records are managed by the admins)
router.patch(
  '/me',
  verifyToken,
  requireRoles(['SUPER_ADMIN', 'ADMIN']),
  validate(updateProfileSchema),
  AuthController.updateMe
);

// 5. Change own password (any signed-in user, needs the current password)
router.patch('/change-password', verifyToken, validate(changePasswordSchema), AuthController.changePassword);

export default router;
