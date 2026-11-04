import { Router } from 'express';
import { SchedulesController } from './schedules.controller.js';
import { schedulesValidation } from './schedules.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// All schedule routes require authentication
router.use(authenticate);

// Specific Named Routes (Mounted before param routes)

/**
 * GET /api/v1/schedules/school?termId=...
 * Cumulative school timetable (Admin)
 */
router.get(
  '/school',
  authorize('ADMIN', 'SUPER_ADMIN'),
  SchedulesController.getSchoolSchedule
);

/**
 * GET /api/v1/schedules/my-schedule?termId=...
 * Logged-in teacher's weekly schedule (Teacher Portal)
 */
router.get(
  '/my-schedule',
  authorize('TEACHER'),
  SchedulesController.getMySchedule
);

/**
 * GET /api/v1/schedules/my-class?termId=...
 * Logged-in student's class weekly schedule (Student Portal)
 */
router.get(
  '/my-class',
  authorize('STUDENT'),
  SchedulesController.getMyClassSchedule
);

// Teacher-specific schedule routes

/**
 * PUT /api/v1/schedules/teachers/:teacherId
 * Save / replace teacher weekly schedule (Admin)
 */
router.put(
  '/teachers/:teacherId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(schedulesValidation.saveTeacherSchedule),
  SchedulesController.saveTeacherSchedule
);

/**
 * GET /api/v1/schedules/teachers/:teacherId?termId=...
 * Get specific teacher weekly schedule (Admin + Teacher)
 */
router.get(
  '/teachers/:teacherId',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  SchedulesController.getTeacherSchedule
);

router.get(
  '/teacher/:teacherId',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  SchedulesController.getTeacherSchedule
);

// Class schedule route (by classId)
router.get(
  '/class/:classId',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT'),
  SchedulesController.getClassSchedule
);

// Convenient alias routes for direct :teacherId access
router.put(
  '/:teacherId',
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(schedulesValidation.saveTeacherSchedule),
  SchedulesController.saveTeacherSchedule
);

router.get(
  '/:teacherId',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  SchedulesController.getTeacherSchedule
);

export default router;
