import { Router } from 'express';
import { SubjectsController } from './subjects.controller.js';
import { subjectsValidation } from './subjects.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', SubjectsController.getAll);
router.get('/:id', SubjectsController.getById);
router.post('/', authorize('ADMIN'), validate(subjectsValidation.createSubject), SubjectsController.create);
router.put('/:id', authorize('ADMIN'), validate(subjectsValidation.updateSubject), SubjectsController.update);
router.delete('/:id', authorize('ADMIN'), SubjectsController.remove);

export default router;

