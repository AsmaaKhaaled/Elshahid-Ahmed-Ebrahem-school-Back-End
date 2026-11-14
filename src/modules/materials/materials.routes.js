import { Router } from 'express';
import { MaterialsController } from './materials.controller.js';
import { MAX_FILES_PER_MATERIAL, MAX_FORM_FIELDS, materialsValidation } from './materials.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, requireRoles } from '../../middlewares/auth.middleware.js';
import { uploadDocuments } from '../../middlewares/upload.middleware.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';

const router = Router();
const teacherOnly = requireRoles(['TEACHER']);
const uploadMaterialFiles = uploadDocuments('materials', 'files', MAX_FILES_PER_MATERIAL, MAX_FORM_FIELDS);

/**
 * المواد والملفات التعليمية
 * - Reading: a teacher their own, a student their class's (as soon as the teacher saves it), the administration all.
 * - Changing: the teacher who published the material.
 */
router.use(verifyToken, requireRoles(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']));

router.get('/', validate(materialsValidation.listQuery), MaterialsController.list);
router.post('/', teacherOnly, uploadMaterialFiles, validate(materialsValidation.save), MaterialsController.create);
router.get('/:id', validate(materialsValidation.idParam), MaterialsController.getById);
router.put(
  '/:id',
  teacherOnly,
  validate(materialsValidation.idParam),
  uploadMaterialFiles,
  validate(materialsValidation.save),
  MaterialsController.update
);
router.delete('/:id', teacherOnly, validate(materialsValidation.idParam), MaterialsController.remove);
router.get('/:id/files/:fileId/download', validate(materialsValidation.idParam), MaterialsController.downloadFile);

// A request that failed after its files were saved (validation, not the owner...) leaves nothing behind
router.use(async (error, req, res, next) => {
  const saved = (req.files ?? []).filter((file) => file?.path);
  if (saved.length) await removeStoredFiles(saved.map(storageKey));
  next(error);
});

export default router;
