import { TeacherAttendanceService, schoolToday } from './teacher-attendance.service.js';

export class TeacherAttendanceController {
  /**
   * GET /api/v1/teacher-attendance/day/:date   ("today" is accepted for the school's current date)
   */
  static async getDay(req, res, next) {
    try {
      const day = await TeacherAttendanceService.getDay(req.params.date);
      return res.status(200).json({ status: 'success', data: { day } });
    } catch (error) {
      next(error);
    }
  }

  static async getToday(req, res, next) {
    try {
      const day = await TeacherAttendanceService.getDay(schoolToday());
      return res.status(200).json({ status: 'success', data: { day } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/teacher-attendance/day/:date
   */
  static async saveDay(req, res, next) {
    try {
      const day = await TeacherAttendanceService.saveDay(req.params.date, req.body.records, req.user.id);
      return res.status(200).json({ status: 'success', message: 'تم حفظ دفتر الحضور', data: { day } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/teacher-attendance/day/:date/close
   */
  static async closeDay(req, res, next) {
    try {
      const day = await TeacherAttendanceService.closeDay(req.params.date, req.user.id);
      return res.status(200).json({ status: 'success', message: 'تم اعتماد دفتر اليوم', data: { day } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/teacher-attendance/day/:date/reopen   (super admin)
   */
  static async reopenDay(req, res, next) {
    try {
      const day = await TeacherAttendanceService.reopenDay(req.params.date);
      return res.status(200).json({ status: 'success', message: 'تم فتح دفتر اليوم للتعديل', data: { day } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teacher-attendance/records?from&to&teacherId&status&page&pageSize
   */
  static async getArchive(req, res, next) {
    try {
      const { items, summary, meta } = await TeacherAttendanceService.getArchive(req.query);
      return res.status(200).json({ status: 'success', data: { records: items, summary }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teacher-attendance/export?from&to&teacherId&status
   */
  static async exportArchive(req, res, next) {
    try {
      const records = await TeacherAttendanceService.exportArchive(req.query);
      return res.status(200).json({ status: 'success', results: records.length, data: { records } });
    } catch (error) {
      next(error);
    }
  }

  static async getHolidays(req, res, next) {
    try {
      const holidays = await TeacherAttendanceService.getHolidays();
      return res.status(200).json({ status: 'success', results: holidays.length, data: { holidays } });
    } catch (error) {
      next(error);
    }
  }

  static async createHoliday(req, res, next) {
    try {
      const holiday = await TeacherAttendanceService.createHoliday(req.body, req.user.id);
      return res.status(201).json({ status: 'success', message: 'تم تسجيل الإجازة', data: { holiday } });
    } catch (error) {
      next(error);
    }
  }

  static async deleteHoliday(req, res, next) {
    try {
      await TeacherAttendanceService.deleteHoliday(req.params.id);
      return res.status(200).json({ status: 'success', message: 'تم حذف الإجازة' });
    } catch (error) {
      next(error);
    }
  }
}

export default TeacherAttendanceController;
