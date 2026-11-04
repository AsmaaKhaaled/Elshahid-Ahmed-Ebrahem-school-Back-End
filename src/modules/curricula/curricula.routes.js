import { Router } from 'express';
import { CurriculaController } from './curricula.controller.js';
import { curriculaValidation } from './curricula.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, requireRoles } from '../../middlewares/auth.middleware.js';
import { uploadDocument } from '../../middlewares/upload.middleware.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';

const router = Router();
const teacherOnly = requireRoles(['TEACHER']);
const uploadCurriculumFile = uploadDocument('curricula');

/**
 * المناهج والمواد الدراسية
 * - Reading: a teacher their own, the administration every teacher's, a student their class's.
 * - Changing: the teacher who owns the curriculum.
 */
router.use(verifyToken, requireRoles(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']));

router.get('/', validate(curriculaValidation.listQuery), CurriculaController.list);
router.post('/', teacherOnly, validate(curriculaValidation.saveCurriculum), CurriculaController.create);
router.get('/:id', validate(curriculaValidation.idParam), CurriculaController.getById);
router.put('/:id', teacherOnly, validate(curriculaValidation.idParam), validate(curriculaValidation.saveCurriculum), CurriculaController.update);
router.delete('/:id', teacherOnly, validate(curriculaValidation.idParam), CurriculaController.remove);

// Files & links (paged)
router.get('/:id/files', validate(curriculaValidation.idParam), validate(curriculaValidation.filesQuery), CurriculaController.listFiles);
router.post(
  '/:id/files',
  teacherOnly,
  validate(curriculaValidation.idParam),
  uploadCurriculumFile,
  validate(curriculaValidation.addFile),
  CurriculaController.addFile
);
router.get('/:id/files/:fileId/download', validate(curriculaValidation.idParam), CurriculaController.downloadFile);
router.delete('/:id/files/:fileId', teacherOnly, validate(curriculaValidation.idParam), CurriculaController.deleteFile);

// The plan & objectives
router.put('/:id/plan', teacherOnly, validate(curriculaValidation.idParam), validate(curriculaValidation.savePlan), CurriculaController.savePlan);
router.get('/:id/plan-file', validate(curriculaValidation.idParam), CurriculaController.downloadPlanFile);
router.put('/:id/plan-file', teacherOnly, validate(curriculaValidation.idParam), uploadCurriculumFile, CurriculaController.setPlanFile);
router.delete('/:id/plan-file', teacherOnly, validate(curriculaValidation.idParam), CurriculaController.deletePlanFile);

// A request that failed after its file was saved (validation, not the owner...) leaves nothing behind
router.use(async (error, req, res, next) => {
  if (req.file?.path) await removeStoredFiles([storageKey(req.file)]);
  next(error);
});

export default router;
