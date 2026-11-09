import { Router } from 'express';
import { HomeContentController } from './home-content.controller.js';
import { homeContentValidation } from './home-content.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// ① Public Routes: View Full Home Content, Principal's Word, or Gallery Slides
router.get('/', HomeContentController.getHomeContent);
router.get('/principal', HomeContentController.getPrincipalWord);
router.get('/gallery', HomeContentController.getGallerySlides);

// ② Admin Protected Route: Update Principal's Word
router.put(
  '/principal',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(homeContentValidation.updatePrincipalWord),
  HomeContentController.updatePrincipalWord
);

// ③ Admin Protected Routes: School Gallery Slides
// Notice: /gallery/reorder is placed before /gallery/:id to prevent matching 'reorder' as an ID
router.post(
  '/gallery',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(homeContentValidation.createGallerySlide),
  HomeContentController.createGallerySlide
);

router.put(
  '/gallery/reorder',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(homeContentValidation.reorderGallerySlides),
  HomeContentController.reorderGallerySlides
);

router.put(
  '/gallery/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(homeContentValidation.updateGallerySlide),
  HomeContentController.updateGallerySlide
);

router.patch(
  '/gallery/:id/toggle-hidden',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  HomeContentController.toggleHidden
);

router.delete(
  '/gallery/:id',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  HomeContentController.deleteGallerySlide
);

export default router;

