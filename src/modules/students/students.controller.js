import { StudentsService } from './students.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const sendExcel = (res, buffer, fileName) => {
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.send(buffer);
};

export class StudentsController {
  static async getAll(req, res, next) {
    try {
      const { students, total } = await StudentsService.getStudents(req.query, req.user);

      const paginated = req.query.page !== undefined || req.query.limit !== undefined;
      const page = paginated ? Math.max(1, parseInt(req.query.page, 10) || 1) : 1;
      const limit = paginated ? Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100) : total;
      const totalPages = paginated ? Math.ceil(total / limit) || 1 : 1;

      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم جلب بيانات الطلاب بنجاح',
        data: students,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNextCode(req, res, next) {
    try {
      const studentCode = await StudentsService.getNextStudentCode();
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم توليد كود الطالب بنجاح',
        data: { studentCode },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const student = await StudentsService.getStudentById(req.params.id, req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم استرجاع بيانات الطالب بنجاح',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  /** GET /students/me/teachers (the signed-in student) and GET /students/:id/teachers */
  static async getTeachers(req, res, next) {
    try {
      const studentId = req.params.id ?? req.user.studentProfile?.id;
      if (!studentId) {
        throw AppError.forbidden('هذا الحساب غير مرتبط بملف طالب');
      }
      const result = await StudentsService.getStudentTeachers(studentId, req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم جلب مدرسي الطالب بنجاح',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const student = await StudentsService.createStudent(req.body);
      return ApiResponse.created(res, student, 'تم تسجيل الطالب بنجاح بالمنظومة');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await StudentsService.updateStudent(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تحديث بيانات الطالب بنجاح',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async enroll(req, res, next) {
    try {
      const { classId, className } = req.body;
      const updated = await StudentsService.enrollStudent(req.params.id, classId || className);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تسكين الطالب في الفصل بنجاح',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /** POST /students/distribute { gradeLevel? } */
  static async distribute(req, res, next) {
    try {
      const result = await StudentsService.distributeStudents(req.body || {});
      return ApiResponse.success(res, {
        statusCode: 200,
        message: `تم توزيع ${result.placedCount} طالب على الفصول`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkImport(req, res, next) {
    try {
      const { students } = req.body;
      const result = await StudentsService.bulkImportStudents(students);
      return ApiResponse.created(res, result, 'تم استيراد بيانات الطلاب بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async uploadExcel(req, res, next) {
    try {
      if (!req.file || !req.file.buffer) {
        throw AppError.badRequest('يرجى اختيار وإرفاق ملف إكسيل (.xlsx, .xls, .csv)');
      }
      const result = await StudentsService.importFromExcel(req.file.buffer);
      return ApiResponse.created(res, result, 'تم استيراد ومعالجة ملف الإكسيل بنجاح');
    } catch (error) {
      next(error);
    }
  }

  static async downloadTemplate(req, res, next) {
    try {
      return sendExcel(res, StudentsService.generateExcelTemplate(), 'students_template.xlsx');
    } catch (error) {
      next(error);
    }
  }

  /** GET /students/export?classId&gradeLevel&enrollmentStatus&search&withoutClass */
  static async exportExcel(req, res, next) {
    try {
      const buffer = await StudentsService.exportStudentsExcel(req.query);
      return sendExcel(res, buffer, 'students.xlsx');
    } catch (error) {
      next(error);
    }
  }

  static async generateCard(req, res, next) {
    try {
      const cardData = await StudentsService.generateStudentCard(req.params.id, req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم إصدار بطاقة تعريف الطالب بنجاح',
        data: cardData,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await StudentsService.deleteStudent(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم حذف قيد الطالب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default StudentsController;
