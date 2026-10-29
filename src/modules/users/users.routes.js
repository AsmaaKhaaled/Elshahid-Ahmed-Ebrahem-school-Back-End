import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { usersValidation } from './users.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// Identity & profile management
router.get('/me', UsersController.getMe);
router.patch('/me/change-password', validate(usersValidation.changePassword), UsersController.changePassword);

// User administration
router.get('/', authorize('ADMIN'), UsersController.getAll);
router.get('/:id', authorize('ADMIN', 'TEACHER'), UsersController.getById);
router.post('/', authorize('ADMIN'), validate(usersValidation.createUser), UsersController.create);
router.put('/:id', authorize('ADMIN'), validate(usersValidation.updateUser), UsersController.update);
router.delete('/:id', authorize('ADMIN'), UsersController.remove);

export default router;
