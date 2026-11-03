import { GradesService } from './grades.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';

export class GradesController {
  // --- Exam Schedules ---
  static async getAllExams(req, res, next) {
    try {
      const exams = await GradesService.getExams(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Exam schedules retrieved successfully',
        data: exams,
        meta: { total: exams.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getExamById(req, res, next) {
    try {
      const exam = await GradesService.getExamById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Exam schedule retrieved successfully',
        data: exam,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createExam(req, res, next) {
    try {
      const payload = {
        ...req.body,
        announcedById: req.user.id,
      };
      const exam = await GradesService.createExam(payload);
      return ApiResponse.created(res, exam, 'Exam schedule announced successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateExam(req, res, next) {
    try {
      const updated = await GradesService.updateExam(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Exam schedule updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeExam(req, res, next) {
    try {
      await GradesService.deleteExam(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Exam schedule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Marks Recording ---
  static async getAll(req, res, next) {
    try {
      const grades = await GradesService.getGrades(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Grades retrieved successfully',
        data: grades,
        meta: { total: grades.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const grade = await GradesService.getGradeById(req.params.id);
      if (req.user.role === 'STUDENT') {
        const studentProfileId = req.user.studentProfile?.id;
        if (!studentProfileId || (grade.studentId !== studentProfileId && grade.student?.userId !== req.user.id)) {
          throw AppError.forbidden('غير مصرح لك بالاطلاع على درجات طالب آخر');
        }
      }
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Grade retrieved successfully',
        data: grade,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentReportCard(req, res, next) {
    try {
      if (req.user.role === 'STUDENT') {
        const studentProfileId = req.user.studentProfile?.id;
        if (!studentProfileId || (studentProfileId !== req.params.studentId && req.user.id !== req.params.studentId)) {
          throw AppError.forbidden('غير مصرح لك بالاطلاع على شهادة درجات طالب آخر');
        }
      }
      const report = await GradesService.getStudentReportCard(req.params.studentId);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student report card generated successfully',
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submit(req, res, next) {
    try {
      const payload = {
        ...req.body,
        recordedById: req.user.id,
      };
      const grade = await GradesService.submitGrade(payload);
      return ApiResponse.created(res, grade, 'Grade recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async recordBulk(req, res, next) {
    try {
      const payload = {
        ...req.body,
        recordedById: req.user.id,
      };
      const result = await GradesService.recordBulkMarks(payload);
      return ApiResponse.created(res, result, 'Class marks recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await GradesService.updateGrade(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Grade updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await GradesService.deleteGrade(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Grade deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default GradesController;
