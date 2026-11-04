import { Router } from 'express';
import { AnnouncementsController } from './announcements.controller.js';
import { announcementsValidation } from './announcements.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// All announcement routes require authentication
router.use(authenticate);

// 1. Notification & Read Tracking Routes (Mounted before :id)
router.get('/unread-count', AnnouncementsController.getUnreadCount);
router.post('/read-all', AnnouncementsController.markAllAsRead);

// 2. Fetch Announcements
router.get('/', AnnouncementsController.getAll);
router.get('/:id', AnnouncementsController.getById);

// 3. Mark Single Announcement As Read
router.post('/:id/read', AnnouncementsController.markAsRead);

// 4. Pin / Unpin
router.patch(
  '/:id/pin',
  authorize('ADMIN', 'SUPER_ADMIN'),
  AnnouncementsController.togglePinned
);

// 5. Admin can create school-wide or class announcements; Teacher can create class notes
router.post(
  '/',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  validate(announcementsValidation.createAnnouncement),
  AnnouncementsController.create
);

router.put(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  validate(announcementsValidation.updateAnnouncement),
  AnnouncementsController.update
);

router.delete(
  '/:id',
  authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'),
  AnnouncementsController.remove
);

export default router;
