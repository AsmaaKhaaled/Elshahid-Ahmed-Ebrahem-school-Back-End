import { ClassesService } from './classes.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class ClassesController {
  static async getStructure(req, res, next) {
    try {
      const grades = await ClassesService.getStructure();
      return ApiResponse.success(res, { statusCode: 200, message: 'Class structure retrieved successfully', data: { grades } });
    } catch (error) {
      next(error);
    }
  }

  static async saveStructure(req, res, next) {
    try {
      const grades = await ClassesService.saveStructure(req.body);
      return ApiResponse.success(res, { statusCode: 200, message: 'Class structure saved successfully', data: { grades } });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req, res, next) {
    try {
      const classes = await ClassesService.getClasses(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Classes retrieved successfully',
        data: classes,
        meta: { total: classes.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const cls = await ClassesService.getClassById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Class retrieved successfully',
        data: cls,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const cls = await ClassesService.createClass(req.body);
      return ApiResponse.created(res, cls, 'Class created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await ClassesService.updateClass(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Class updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await ClassesService.deleteClass(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Class deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default ClassesController;

