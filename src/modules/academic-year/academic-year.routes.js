import { Router } from 'express';
import { AcademicYearController } from './academic-year.controller.js';
import { academicYearValidation } from './academic-year.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, checkPermission } from '../../middlewares/auth.middleware.js';

const router = Router();

// ① Get Current Term (Public & Authenticated: Used across headers and all pages)
router.get('/current', AcademicYearController.getCurrentTerm);

// All other routes require authentication
router.use(authenticate);

// ② Get All Terms (All authenticated users: Admin, Teacher, Student)
router.get('/', AcademicYearController.getAllTerms);

// ③ Transition to Next Term (Admin / Super Admin)
router.post(
  '/transition',
  checkPermission('academic-year'),
  AcademicYearController.transitionToNextTerm
);

// ④ Add Next Term (Admin / Super Admin)
router.post(
  '/next',
  checkPermission('academic-year'),
  validate(academicYearValidation.addNextTerm),
  AcademicYearController.addNextTerm
);

// ⑤ Update Planned Dates (Admin / Super Admin)
router.patch(
  '/terms/:id/dates',
  checkPermission('academic-year'),
  validate(academicYearValidation.termIdParam),
  validate(academicYearValidation.updatePlannedDates),
  AcademicYearController.updatePlannedDates
);

// ⑥ Delete Upcoming Term (Admin / Super Admin)
router.delete(
  '/terms/:id',
  checkPermission('academic-year'),
  validate(academicYearValidation.termIdParam),
  AcademicYearController.deleteUpcomingTerm
);

export default router;

