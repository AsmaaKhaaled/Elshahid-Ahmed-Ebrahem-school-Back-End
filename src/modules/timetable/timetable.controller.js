import { TimetableService } from './timetable.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class TimetableController {
  static async getAll(req, res, next) {
    try {
      const timetable = await TimetableService.getTimetable(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Timetable retrieved successfully',
        data: timetable,
        meta: { total: timetable.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const entry = await TimetableService.getTimetableEntryById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Timetable entry retrieved successfully',
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getByClass(req, res, next) {
    try {
      const timetable = await TimetableService.getTimetableByClass(req.params.classId);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Class timetable retrieved successfully',
        data: timetable,
        meta: { total: timetable.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getByTeacher(req, res, next) {
    try {
      const timetable = await TimetableService.getTimetableByTeacher(req.params.teacherId);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Teacher timetable retrieved successfully',
        data: timetable,
        meta: { total: timetable.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const entry = await TimetableService.createTimetableEntry(req.body);
      return ApiResponse.created(res, entry, 'Timetable entry created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await TimetableService.updateTimetableEntry(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Timetable entry updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await TimetableService.deleteTimetableEntry(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Timetable entry deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default TimetableController;
