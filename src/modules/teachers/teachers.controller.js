import { TeachersService } from './teachers.service.js';
import { AppError } from '../../shared/errors/app-error.js';

// The teacher profile behind the signed-in TEACHER account
const myTeacherId = (req) => {
  const teacherId = req.user.teacherProfile?.id;
  if (!teacherId) {
    throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');
  }
  return teacherId;
};

export class TeachersController {
  /**
   * GET /api/v1/teachers/me/classes
   */
  static async getMyClasses(req, res, next) {
    try {
      const classes = await TeachersService.getMyClasses(myTeacherId(req));
      return res.status(200).json({ status: 'success', results: classes.length, data: { classes } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teachers/me/classes/:classId/students?page&limit&search
   */
  static async getMyClassStudents(req, res, next) {
    try {
      const { class: cls, students, meta } = await TeachersService.getMyClassStudents(
        myTeacherId(req),
        req.params.classId,
        req.query
      );
      return res.status(200).json({ status: 'success', data: { class: cls, students }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teachers
   */
  static async getAll(req, res, next) {
    try {
      const teachers = await TeachersService.getTeachers(req.user);
      return res.status(200).json({ status: 'success', results: teachers.length, data: { teachers } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teachers/class-options
   */
  static async getClassOptions(req, res, next) {
    try {
      const classes = await TeachersService.getClassOptions();
      return res.status(200).json({ status: 'success', data: { classes } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/teachers/:id
   */
  static async getById(req, res, next) {
    try {
      const teacher = await TeachersService.getTeacherById(req.params.id);
      return res.status(200).json({ status: 'success', data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/teachers
   */
  static async create(req, res, next) {
    try {
      const teacher = await TeachersService.createTeacher(req.body);
      return res.status(201).json({ status: 'success', message: 'تمت إضافة المعلم', data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/teachers/:id
   */
  static async update(req, res, next) {
    try {
      const teacher = await TeachersService.updateTeacher(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'تم حفظ بيانات المعلم', data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/teachers/:id
   */
  static async remove(req, res, next) {
    try {
      const { removedPeriods } = await TeachersService.deleteTeacher(req.params.id);
      const message = removedPeriods ? `تم حذف المعلم و${removedPeriods} حصة من الجدول` : 'تم حذف المعلم';
      return res.status(200).json({ status: 'success', message, data: { removedPeriods } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/teachers/:id/deactivate (left the school)
   */
  static async deactivate(req, res, next) {
    try {
      const { teacher, removedPeriods, removedAdvisedClasses } = await TeachersService.deactivateTeacher(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: `تم إيقاف المعلم${removedPeriods ? ` وشيل ${removedPeriods} حصة من الجدول` : ''}`,
        data: { teacher, removedPeriods, removedAdvisedClasses },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/teachers/:id/activate
   */
  static async activate(req, res, next) {
    try {
      const teacher = await TeachersService.activateTeacher(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'تم تفعيل المعلم. حدد مواده وفصوله من جديد',
        data: { teacher },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default TeachersController;
