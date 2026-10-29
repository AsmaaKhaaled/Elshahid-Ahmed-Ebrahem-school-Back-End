import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authValidation } from './auth.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', validate(authValidation.register), AuthController.register);
router.post('/login', validate(authValidation.login), AuthController.login);
router.post('/refresh-token', validate(authValidation.refreshToken), AuthController.refreshToken);
router.get('/me', authenticate, AuthController.getMe);

export default router;

