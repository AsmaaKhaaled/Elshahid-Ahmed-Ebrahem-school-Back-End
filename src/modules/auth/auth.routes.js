import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { loginSchema, setInitialPasswordSchema } from './auth.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, verifyTempToken } from '../../middlewares/auth.middleware.js';

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

export default router;
