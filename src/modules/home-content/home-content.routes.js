import { Router } from 'express';
import { HomeContentController } from './home-content.controller.js';
import { homeContentValidation } from './home-content.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, checkPermission } from '../../middlewares/auth.middleware.js';

const router = Router();

// ① Public Routes: View Full Home Content, Principal's Word, or Gallery Slides
router.get('/', HomeContentController.getHomeContent);
router.get('/principal', HomeContentController.getPrincipalWord);
router.get('/gallery', HomeContentController.getGallerySlides);

// ② Admin Protected Route: Update Principal's Word
router.put(
  '/principal',
  authenticate,
  checkPermission('home-content'),
  validate(homeContentValidation.updatePrincipalWord),
  HomeContentController.updatePrincipalWord
);

// ③ Admin Protected Routes: School Gallery Slides
// Notice: /gallery/reorder is placed before /gallery/:id to prevent matching 'reorder' as an ID
router.post(
  '/gallery',
  authenticate,
  checkPermission('home-content'),
  validate(homeContentValidation.createGallerySlide),
  HomeContentController.createGallerySlide
);

router.put(
  '/gallery/reorder',
  authenticate,
  checkPermission('home-content'),
  validate(homeContentValidation.reorderGallerySlides),
  HomeContentController.reorderGallerySlides
);

router.put(
  '/gallery/:id',
  authenticate,
  checkPermission('home-content'),
  validate(homeContentValidation.updateGallerySlide),
  HomeContentController.updateGallerySlide
);

router.patch(
  '/gallery/:id/toggle-hidden',
  authenticate,
  checkPermission('home-content'),
  HomeContentController.toggleHidden
);

router.delete(
  '/gallery/:id',
  authenticate,
  checkPermission('home-content'),
  HomeContentController.deleteGallerySlide
);

export default router;

