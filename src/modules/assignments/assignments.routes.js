import { Router } from 'express';
import { AssignmentsController } from './assignments.controller.js';
import { MAX_FILES_PER_SUBMISSION } from './assignments.service.js';
import { assignmentsValidation } from './assignments.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { verifyToken, requireRoles } from '../../middlewares/auth.middleware.js';
import { uploadDocument, uploadDocuments } from '../../middlewares/upload.middleware.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';

const router = Router();
const teacherOnly = requireRoles(['TEACHER']);
const studentOnly = requireRoles(['STUDENT']);
const staffOnly = requireRoles(['SUPER_ADMIN', 'ADMIN', 'TEACHER']);
const uploadAssignmentFile = uploadDocument('assignments');
const uploadAnswerFiles = uploadDocuments('assignment-submissions', 'files', MAX_FILES_PER_SUBMISSION);

/**
 * الواجبات والتكليفات المدرسية
 * - Reading: a teacher their own, a student their class's, the administration all.
 * - Changing: the teacher who published the assignment; a student only their own answer.
 */
router.use(verifyToken, requireRoles(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']));

router.get('/', validate(assignmentsValidation.listQuery), AssignmentsController.list);
router.post('/', teacherOnly, validate(assignmentsValidation.create), AssignmentsController.create);
router.get('/:id', validate(assignmentsValidation.idParam), AssignmentsController.getById);
router.put('/:id', teacherOnly, validate(assignmentsValidation.idParam), validate(assignmentsValidation.update), AssignmentsController.update);
router.delete('/:id', teacherOnly, validate(assignmentsValidation.idParam), AssignmentsController.remove);

// The teacher's files
router.post(
  '/:id/attachments',
  teacherOnly,
  validate(assignmentsValidation.idParam),
  uploadAssignmentFile,
  validate(assignmentsValidation.addAttachment),
  AssignmentsController.addAttachment
);
router.get('/:id/attachments/:attachmentId/download', validate(assignmentsValidation.idParam), AssignmentsController.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', teacherOnly, validate(assignmentsValidation.idParam), AssignmentsController.deleteAttachment);

// The students' answers
router.post(
  '/:id/submission',
  studentOnly,
  validate(assignmentsValidation.idParam),
  uploadAnswerFiles,
  validate(assignmentsValidation.submit),
  AssignmentsController.submit
);
router.get('/:id/submissions', staffOnly, validate(assignmentsValidation.idParam), AssignmentsController.listSubmissions);
router.put(
  '/:id/submissions/:submissionId/grade',
  teacherOnly,
  validate(assignmentsValidation.idParam),
  validate(assignmentsValidation.grade),
  AssignmentsController.grade
);
router.get('/:id/submissions/:submissionId/files/:fileId/download', validate(assignmentsValidation.idParam), AssignmentsController.downloadSubmissionFile);

// A request that failed after its files were saved (validation, not the owner...) leaves nothing behind
router.use(async (error, req, res, next) => {
  const saved = [req.file, ...(req.files ?? [])].filter((file) => file?.path);
  if (saved.length) await removeStoredFiles(saved.map(storageKey));
  next(error);
});

export default router;
