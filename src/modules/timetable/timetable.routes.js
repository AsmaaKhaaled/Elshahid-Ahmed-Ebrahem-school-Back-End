import { Router } from 'express';
import { TimetableController } from './timetable.controller.js';
import { timetableValidation } from './timetable.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', TimetableController.getAll);
router.get('/class/:classId', TimetableController.getByClass);
router.get('/teacher/:teacherId', TimetableController.getByTeacher);
router.get('/:id', TimetableController.getById);

router.post('/', authorize('ADMIN'), validate(timetableValidation.createEntry), TimetableController.create);
router.put('/:id', authorize('ADMIN'), validate(timetableValidation.updateEntry), TimetableController.update);
router.delete('/:id', authorize('ADMIN'), TimetableController.remove);

export default router;
