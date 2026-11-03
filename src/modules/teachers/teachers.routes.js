import { Router } from 'express';
import { TeachersController } from './teachers.controller.js';
import { teachersValidation } from './teachers.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, requireRoles, checkPermission } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyToken);

// Reading: every admin (other pages list teachers, e.g. class advisors) and teachers (a reduced view)
router.get('/', requireRoles(['SUPER_ADMIN', 'ADMIN', 'TEACHER']), TeachersController.getAll);

// The signed-in teacher's own classes and their students (the admin assigns them on the teachers page)
router.get('/me/classes', requireRoles(['TEACHER']), TeachersController.getMyClasses);
router.get('/me/classes/:classId/students', requireRoles(['TEACHER']), TeachersController.getMyClassStudents);

// Managing: SUPER_ADMIN, or an ADMIN granted the 'teachers' section
router.get('/class-options', checkPermission('teachers'), TeachersController.getClassOptions);
router.get('/:id', checkPermission('teachers'), TeachersController.getById);
router.post('/', checkPermission('teachers'), validate(teachersValidation.createTeacher), TeachersController.create);
router.put('/:id', checkPermission('teachers'), validate(teachersValidation.updateTeacher), TeachersController.update);
router.delete('/:id', checkPermission('teachers'), TeachersController.remove);

export default router;
