import { AttendanceService } from './attendance.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';
import { AppError } from '../../shared/errors/app-error.js';
import { doneBy } from '../auth/accounts.js';

export class AttendanceController {
  static async getAll(req, res, next) {
    try {
      const records = await AttendanceService.getAttendance(req.query, req.user);
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
      // Only a record the viewer may see (a student: their own; a teacher: their classes)
      const record = await AttendanceService.getAttendanceById(req.params.id, req.user);
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
      if (req.user.role === 'STUDENT') {
        const studentProfileId = req.user.studentProfile?.id;
        if (!studentProfileId || (studentProfileId !== req.params.studentId && req.user.id !== req.params.studentId)) {
          throw AppError.forbidden('غير مصرح لك بالاطلاع على سجل حضور طالب آخر');
        }
      }
      const rate = await AttendanceService.getStudentAttendanceRate(req.params.studentId, req.user);
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
      const rate = await AttendanceService.getClassAttendanceRate(req.params.classId, req.query.date, req.user);
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
        // An admin (users) or a teacher (teachers)
        ...doneBy(req.user, 'recordedById', 'recordedByTeacherId'),
      };
      const record = await AttendanceService.recordAttendance(payload, req.user);
      return ApiResponse.created(res, record, 'Attendance recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async recordDailyClass(req, res, next) {
    try {
      const payload = {
        ...req.body,
        recordedBy: doneBy(req.user, 'recordedById', 'recordedByTeacherId'),
      };
      const result = await AttendanceService.recordDailyClassAttendance(payload, req.user);
      return ApiResponse.created(res, result, 'Daily class attendance recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await AttendanceService.updateAttendance(req.params.id, req.body, req.user);
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
