import { Router } from 'express';
import { MaterialsController } from './materials.controller.js';
import { materialsValidation } from './materials.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// All authenticated roles (Admin, Teacher, Student) can view materials
router.get('/', MaterialsController.getAll);
router.get('/:id', MaterialsController.getById);

// Admin and Teachers can upload / manage curriculum & lesson plan PDFs
router.post('/', authorize('ADMIN', 'TEACHER'), validate(materialsValidation.createMaterial), MaterialsController.create);
router.put('/:id', authorize('ADMIN', 'TEACHER'), validate(materialsValidation.updateMaterial), MaterialsController.update);
router.delete('/:id', authorize('ADMIN', 'TEACHER'), MaterialsController.remove);

export default router;

