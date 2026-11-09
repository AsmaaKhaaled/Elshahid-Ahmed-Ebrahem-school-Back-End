import { Router } from 'express';
import { HonorRollController } from './honor-roll.controller.js';
import { honorRollValidation } from './honor-roll.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

// ==========================================
// 1. Public Routes (Home page & Viewers)
// ==========================================

// Get all active honor roll entries (or filtered)
router.get('/', HonorRollController.getAll);

// Autocomplete search candidates for teachers/students
// Placed before /:id to prevent matching "candidates" as an ID
router.get(
  '/candidates',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  validate(honorRollValidation.searchCandidates),
  HonorRollController.searchCandidates
);

// Get single entry by ID
router.get('/:id', HonorRollController.getById);

// ==========================================
// 2. Admin Management Routes (Protected)
// ==========================================
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Reorder entries
router.put('/reorder', HonorRollController.reorder);

// Create entry
router.post(
  '/',
  validate(honorRollValidation.createHonorRoll),
  HonorRollController.create
);

// Toggle active status
router.patch('/:id/toggle-active', HonorRollController.toggleActive);

// Update entry
router.put(
  '/:id',
  validate(honorRollValidation.updateHonorRoll),
  HonorRollController.update
);

// Delete entry
router.delete('/:id', HonorRollController.delete);

export default router;

