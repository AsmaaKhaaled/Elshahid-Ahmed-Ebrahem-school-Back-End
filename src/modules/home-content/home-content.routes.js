import { Router } from 'express';
import { HomeContentController } from './home-content.controller.js';
import { homeContentValidation } from './home-content.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// ① Public Routes: View Full Home Content or Principal's Word
router.get('/', HomeContentController.getHomeContent);
router.get('/principal', HomeContentController.getPrincipalWord);

// ② Admin Protected Route: Update Principal's Word
router.put(
  '/principal',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(homeContentValidation.updatePrincipalWord),
  HomeContentController.updatePrincipalWord
);

export default router;

