import { Router } from 'express';
import { StudentsController } from './students.controller.js';
import { studentsValidation } from './students.validation.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate, checkPermission } from '../../middlewares/auth.middleware.js';
import { authorize } from '../../middlewares/role.middleware.js';
import { uploadExcelMiddleware } from '../../middlewares/upload.middleware.js';

const router = Router();

// Public: Excel template download (no auth token required to allow direct browser click/download)
router.get('/excel-template', StudentsController.downloadTemplate);

router.use(authenticate);

// Managing students: SUPER_ADMIN, or an ADMIN granted the 'students' (شؤون الطلاب) section
const manage = checkPermission('students');

// The signed-in student's own teachers
router.get('/me/teachers', authorize('STUDENT'), StudentsController.getTeachers);

router.get('/next-code', manage, StudentsController.getNextCode);
router.get('/export', manage, StudentsController.exportExcel);
router.post('/upload-excel', manage, uploadExcelMiddleware, StudentsController.uploadExcel);
router.post('/bulk-import', manage, validate(studentsValidation.bulkImport), StudentsController.bulkImport);
router.post('/distribute', manage, validate(studentsValidation.distribute), StudentsController.distribute);

// Reading: every admin (other pages count students), a teacher only their own classes' students
router.get('/', authorize('ADMIN', 'TEACHER'), StudentsController.getAll);
router.get('/:id', authorize('ADMIN', 'TEACHER', 'STUDENT'), StudentsController.getById);
router.get('/:id/card', authorize('ADMIN', 'TEACHER', 'STUDENT'), StudentsController.generateCard);
router.get('/:id/teachers', authorize('ADMIN', 'TEACHER', 'STUDENT'), StudentsController.getTeachers);

router.post('/', manage, validate(studentsValidation.createStudent), StudentsController.create);
router.patch('/:id/enroll', manage, validate(studentsValidation.enroll), StudentsController.enroll);
router.put('/:id', manage, validate(studentsValidation.updateStudent), StudentsController.update);
router.delete('/:id', manage, StudentsController.remove);

export default router;
