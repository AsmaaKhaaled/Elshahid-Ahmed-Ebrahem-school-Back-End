import { SubjectsService } from './subjects.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class SubjectsController {
  static async getAll(req, res, next) {
    try {
      const subjects = await SubjectsService.getSubjects(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Subjects retrieved successfully',
        data: subjects,
        meta: { total: subjects.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const subject = await SubjectsService.getSubjectById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Subject retrieved successfully',
        data: subject,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const subject = await SubjectsService.createSubject(req.body);
      return ApiResponse.created(res, subject, 'Subject created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await SubjectsService.updateSubject(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Subject updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await SubjectsService.deleteSubject(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Subject deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default SubjectsController;

