import { AttendanceService } from './attendance.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class AttendanceController {
  static async getAll(req, res, next) {
    try {
      const records = await AttendanceService.getAttendance(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Attendance records retrieved successfully',
        data: records,
        meta: { total: records.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const record = await AttendanceService.getAttendanceById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Attendance record retrieved successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStudentRate(req, res, next) {
    try {
      const rate = await AttendanceService.getStudentAttendanceRate(req.params.studentId);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Student attendance rate calculated successfully',
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getClassRate(req, res, next) {
    try {
      const rate = await AttendanceService.getClassAttendanceRate(req.params.classId, req.query.date);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Class attendance rate calculated successfully',
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }

  static async record(req, res, next) {
    try {
      const payload = {
        ...req.body,
        recordedById: req.user.id,
      };
      const record = await AttendanceService.recordAttendance(payload);
      return ApiResponse.created(res, record, 'Attendance recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async recordDailyClass(req, res, next) {
    try {
      const payload = {
        ...req.body,
        recordedById: req.user.id,
      };
      const result = await AttendanceService.recordDailyClassAttendance(payload);
      return ApiResponse.created(res, result, 'Daily class attendance recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await AttendanceService.updateAttendance(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Attendance updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await AttendanceService.deleteAttendance(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Attendance record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AttendanceController;
