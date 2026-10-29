import { Router } from 'express';
import { AttendanceController } from './attendance.controller.js';
import { attendanceValidation } from './attendance.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// Attendance rate calculations
router.get('/rate/student/:studentId', AttendanceController.getStudentRate);
router.get('/rate/class/:classId', AttendanceController.getClassRate);

// Attendance records queries
router.get('/', authorize('ADMIN', 'TEACHER'), AttendanceController.getAll);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'), AttendanceController.getById);

// Daily attendance recording (single or whole-class batch)
router.post('/daily-class', authorize('ADMIN', 'TEACHER'), validate(attendanceValidation.recordDailyClass), AttendanceController.recordDailyClass);
router.post('/', authorize('ADMIN', 'TEACHER'), validate(attendanceValidation.recordAttendance), AttendanceController.record);
router.put('/:id', authorize('ADMIN', 'TEACHER'), validate(attendanceValidation.updateAttendance), AttendanceController.update);
router.delete('/:id', authorize('ADMIN'), AttendanceController.remove);

export default router;
