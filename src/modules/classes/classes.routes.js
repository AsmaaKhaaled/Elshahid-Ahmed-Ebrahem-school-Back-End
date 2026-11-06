import { Router } from 'express';
import { ClassesController } from './classes.controller.js';
import { classesValidation } from './classes.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// Classes per grade & their capacity (before /:id so "structure" isn't taken for an id)
router.get('/structure', ClassesController.getStructure);
router.put('/structure', authorize('ADMIN'), validate(classesValidation.saveStructure), ClassesController.saveStructure);
router.get('/', ClassesController.getAll);
router.get('/:id', ClassesController.getById);
router.post('/', authorize('ADMIN'), validate(classesValidation.createClass), ClassesController.create);
router.put('/:id', authorize('ADMIN'), validate(classesValidation.updateClass), ClassesController.update);
router.delete('/:id', authorize('ADMIN'), ClassesController.remove);

export default router;

