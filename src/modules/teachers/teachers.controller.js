import { TeachersService } from './teachers.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class TeachersController {
  static async getAll(req, res, next) {
    try {
      const teachers = await TeachersService.getTeachers(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Teachers retrieved successfully',
        data: teachers,
        meta: { total: teachers.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const teacher = await TeachersService.getTeacherById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Teacher retrieved successfully',
        data: teacher,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const teacher = await TeachersService.createTeacher(req.body);
      return ApiResponse.created(res, teacher, 'Teacher added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await TeachersService.updateTeacher(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Teacher updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignSubjects(req, res, next) {
    try {
      const { assignedSubjectIds } = req.body;
      const updated = await TeachersService.assignSubjects(req.params.id, assignedSubjectIds);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Assigned subjects updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignClasses(req, res, next) {
    try {
      const { assignedClassIds } = req.body;
      const updated = await TeachersService.assignClasses(req.params.id, assignedClassIds);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Assigned classes updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await TeachersService.deleteTeacher(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Teacher removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default TeachersController;
