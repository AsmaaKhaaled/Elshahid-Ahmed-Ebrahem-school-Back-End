import { Router } from 'express';
import { GradesController } from './grades.controller.js';
import { gradesValidation } from './grades.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';

const router = Router();

router.use(authenticate);

// --- 1. Exam Schedules Announcement Endpoints ---
router.get('/exams', GradesController.getAllExams);
router.get('/exams/:id', GradesController.getExamById);
router.post('/exams', authorize('ADMIN', 'TEACHER'), validate(gradesValidation.createExam), GradesController.createExam);
router.put('/exams/:id', authorize('ADMIN', 'TEACHER'), validate(gradesValidation.updateExam), GradesController.updateExam);
router.delete('/exams/:id', authorize('ADMIN'), GradesController.removeExam);

// --- 2. Manual Marks & Report Card Endpoints ---
router.get('/student/:studentId/report-card', GradesController.getStudentReportCard);
router.get('/', GradesController.getAll);
router.get('/:id', GradesController.getById);

// Submit marks (single or bulk for a class)
router.post('/bulk', authorize('ADMIN', 'TEACHER'), validate(gradesValidation.recordBulkMarks), GradesController.recordBulk);
router.post('/', authorize('ADMIN', 'TEACHER'), validate(gradesValidation.submitGrade), GradesController.submit);
router.put('/:id', authorize('ADMIN', 'TEACHER'), validate(gradesValidation.updateGrade), GradesController.update);
router.delete('/:id', authorize('ADMIN'), GradesController.remove);

export default router;
