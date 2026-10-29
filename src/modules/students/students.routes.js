import { Router } from 'express';
import { StudentsController } from './students.controller.js';
import { studentsValidation } from './students.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// Student listing and details
router.get('/', authorize('ADMIN', 'TEACHER'), StudentsController.getAll);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), StudentsController.getById);

// Card generation
router.get('/:id/card', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), StudentsController.generateCard);

// Admin-only management
router.post('/', authorize('ADMIN'), validate(studentsValidation.createStudent), StudentsController.create);
router.post('/bulk-import', authorize('ADMIN'), validate(studentsValidation.bulkImport), StudentsController.bulkImport);
router.patch('/:id/enroll', authorize('ADMIN'), validate(studentsValidation.enroll), StudentsController.enroll);
router.put('/:id', authorize('ADMIN'), validate(studentsValidation.updateStudent), StudentsController.update);
router.delete('/:id', authorize('ADMIN'), StudentsController.remove);

export default router;
