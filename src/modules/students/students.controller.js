import { StudentsService } from './students.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class StudentsController {
  static async getAll(req, res, next) {
    try {
      const students = await StudentsService.getStudents(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Students retrieved successfully',
        data: students,
        meta: { total: students.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const student = await StudentsService.getStudentById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student retrieved successfully',
        data: student,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const student = await StudentsService.createStudent(req.body);
      return ApiResponse.created(res, student, 'Student registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await StudentsService.updateStudent(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async enroll(req, res, next) {
    try {
      const { classId } = req.body;
      const updated = await StudentsService.enrollStudent(req.params.id, classId);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student enrolled in class successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async bulkImport(req, res, next) {
    try {
      const { students } = req.body;
      const result = await StudentsService.bulkImportStudents(students);
      return ApiResponse.created(res, result, 'Students imported successfully');
    } catch (error) {
      next(error);
    }
  }

  static async generateCard(req, res, next) {
    try {
      const cardData = await StudentsService.generateStudentCard(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student ID card generated successfully',
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
        message: 'Student removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default StudentsController;
