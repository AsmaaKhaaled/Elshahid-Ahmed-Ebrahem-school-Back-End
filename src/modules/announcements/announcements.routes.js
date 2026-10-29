import { Router } from 'express';
import { AnnouncementsController } from './announcements.controller.js';
import { announcementsValidation } from './announcements.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// View announcements (Admin, Teacher, Student, Parent)
router.get('/', AnnouncementsController.getAll);
router.get('/:id', AnnouncementsController.getById);

// Admin can create school-wide or class announcements; Teacher can create class notes
router.post(
  '/',
  authorize('ADMIN', 'TEACHER'),
  validate(announcementsValidation.createAnnouncement),
  AnnouncementsController.create
);

router.put(
  '/:id',
  authorize('ADMIN', 'TEACHER'),
  validate(announcementsValidation.updateAnnouncement),
  AnnouncementsController.update
);

router.delete(
  '/:id',
  authorize('ADMIN', 'TEACHER'),
  AnnouncementsController.remove
);

export default router;
