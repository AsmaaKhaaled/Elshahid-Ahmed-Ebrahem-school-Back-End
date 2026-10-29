import { Router } from 'express';
import { TeachersController } from './teachers.controller.js';
import { teachersValidation } from './teachers.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// View teachers
router.get('/', authorize('ADMIN', 'TEACHER'), TeachersController.getAll);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'STUDENT', 'PARENT'), TeachersController.getById);

// Admin-only management
router.post('/', authorize('ADMIN'), validate(teachersValidation.createTeacher), TeachersController.create);
router.put('/:id', authorize('ADMIN'), validate(teachersValidation.updateTeacher), TeachersController.update);
router.patch('/:id/subjects', authorize('ADMIN'), validate(teachersValidation.assignSubjects), TeachersController.assignSubjects);
router.patch('/:id/classes', authorize('ADMIN'), validate(teachersValidation.assignClasses), TeachersController.assignClasses);
router.delete('/:id', authorize('ADMIN'), TeachersController.remove);

export default router;
