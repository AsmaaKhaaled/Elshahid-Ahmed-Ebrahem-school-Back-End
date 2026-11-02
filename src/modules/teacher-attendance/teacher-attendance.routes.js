import { Router } from 'express';
import { TeacherAttendanceController } from './teacher-attendance.controller.js';
import { teacherAttendanceValidation } from './teacher-attendance.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, checkPermission, requireSuperAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * Teachers attendance book: SUPER_ADMIN, or an ADMIN granted the 'teacher-attendance' section.
 */
router.use(verifyToken, checkPermission('teacher-attendance'));

// Daily sheet
router.get('/day/today', TeacherAttendanceController.getToday);
router.get('/day/:date', validate(teacherAttendanceValidation.dateParam), TeacherAttendanceController.getDay);
router.put('/day/:date', validate(teacherAttendanceValidation.saveDay), TeacherAttendanceController.saveDay);
router.post('/day/:date/close', validate(teacherAttendanceValidation.dateParam), TeacherAttendanceController.closeDay);
router.post(
  '/day/:date/reopen',
  requireSuperAdmin,
  validate(teacherAttendanceValidation.dateParam),
  TeacherAttendanceController.reopenDay
);

// Archive of approved days
router.get('/records', validate(teacherAttendanceValidation.archiveQuery), TeacherAttendanceController.getArchive);
router.get('/export', validate(teacherAttendanceValidation.archiveQuery), TeacherAttendanceController.exportArchive);

// Official days off (besides Friday & Saturday)
router.get('/holidays', TeacherAttendanceController.getHolidays);
router.post('/holidays', validate(teacherAttendanceValidation.createHoliday), TeacherAttendanceController.createHoliday);
router.delete('/holidays/:id', TeacherAttendanceController.deleteHoliday);

export default router;
