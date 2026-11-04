import { SchedulesService } from './schedules.service.js';
import { AppError } from '../../shared/errors/app-error.js';

export class SchedulesController {
  /**
   * PUT /api/v1/schedules/teachers/:teacherId
   * Save / update a teacher's weekly schedule (Admin)
   */
  static async saveTeacherSchedule(req, res, next) {
    try {
      const { teacherId } = req.params;
      const result = await SchedulesService.saveTeacherSchedule(teacherId, req.body || {});

      return res.status(200).json({
        status: 'success',
        message: 'تم تحديث واعتماد جدول المعلم الأسبوعي بنجاح',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/schedules/teachers/:teacherId?termId=...
   * Get specific teacher's weekly schedule (Admin or the Teacher themself)
   */
  static async getTeacherSchedule(req, res, next) {
    try {
      const { teacherId } = req.params;
      const { termId } = req.query;

      // Access control: If user is TEACHER, they can only view their own schedule
      if (req.user.role === 'TEACHER') {
        const myTeacherId = req.user.teacherProfile?.id;
        if (myTeacherId !== teacherId) {
          throw AppError.forbidden('غير مصرح لك باستعراض جدول معلم آخر');
        }
      }

      const result = await SchedulesService.getTeacherSchedule(teacherId, termId);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/schedules/school?termId=...
   * Get cumulative school schedule for Admin Timetable Tab
   */
  static async getSchoolSchedule(req, res, next) {
    try {
      const { termId } = req.query;
      const result = await SchedulesService.getSchoolSchedule(termId);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/schedules/my-schedule?termId=...
   * Get teacher's own schedule (Teacher Portal)
   */
  static async getMySchedule(req, res, next) {
    try {
      const { termId } = req.query;
      const result = await SchedulesService.getMySchedule(req.user, termId);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/schedules/class/:classId?termId=...
   * Get class weekly schedule (Admin, Teacher, Student)
   */
  static async getClassSchedule(req, res, next) {
    try {
      const { classId } = req.params;
      const { termId } = req.query;
      const result = await SchedulesService.getClassSchedule(classId, termId);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/schedules/my-class?termId=...
   * Get student's class schedule (Student Portal)
   */
  static async getMyClassSchedule(req, res, next) {
    try {
      const { termId } = req.query;
      const result = await SchedulesService.getMyClassSchedule(req.user, termId);

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default SchedulesController;
