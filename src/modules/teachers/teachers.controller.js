import { TeachersService } from './teachers.service.js';

export class TeachersController {
  /**
   * GET /api/v1/teachers
   */
  static async getAll(req, res, next) {
    try {
      const teachers = await TeachersService.getTeachers(req.user.role);
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
      await TeachersService.deleteTeacher(req.params.id);
      return res.status(200).json({ status: 'success', message: 'تم حذف المعلم' });
    } catch (error) {
      next(error);
    }
  }
}

export default TeachersController;
