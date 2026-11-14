import { Router } from 'express';
import { ClassesController } from './classes.controller.js';
import { classesValidation } from './classes.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, checkPermission } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// Classes per grade & their capacity (before /:id so "structure" isn't taken for an id)
router.get('/structure', ClassesController.getStructure);
router.put(
  '/structure',
  checkPermission('classes'),
  validate(classesValidation.saveStructure),
  ClassesController.saveStructure
);

// All classes & single class (Available for Admin, Super Admin, and Teacher)
router.get('/', authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'), ClassesController.getAll);
router.get('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'TEACHER'), ClassesController.getById);

// Assign or Change Class Advisor (supports both PUT and PATCH)
router.put(
  '/:id/advisor',
  checkPermission('classes'),
  validate(classesValidation.assignAdvisor),
  ClassesController.assignAdvisor
);
router.patch(
  '/:id/advisor',
  checkPermission('classes'),
  validate(classesValidation.assignAdvisor),
  ClassesController.assignAdvisor
);

// CRUD operations
router.post(
  '/',
  checkPermission('classes'),
  validate(classesValidation.createClass),
  ClassesController.create
);
router.put(
  '/:id',
  checkPermission('classes'),
  validate(classesValidation.updateClass),
  ClassesController.update
);
router.delete('/:id', checkPermission('classes'), ClassesController.remove);

export default router;
