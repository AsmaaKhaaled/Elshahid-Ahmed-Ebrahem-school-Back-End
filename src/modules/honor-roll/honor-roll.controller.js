import { HonorRollService } from './honor-roll.service.js';

export class HonorRollController {
  /**
   * ① GET /api/v1/honor-roll/candidates?type=TEACHER|STUDENT&q=&limit=10
   */
  static async searchCandidates(req, res, next) {
    try {
      const candidates = await HonorRollService.searchCandidates({
        type: req.query.type,
        q: req.query.q,
        limit: req.query.limit,
      });

      return res.status(200).json({
        status: 'success',
        success: true,
        data: candidates,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ② GET /api/v1/honor-roll
   * Public or admin view with filters
   */
  static async getAll(req, res, next) {
    try {
      const result = await HonorRollService.getHonorRoll(req.query);

      return res.status(200).json({
        status: 'success',
        success: true,
        data: {
          teachers: result.teachers,
          students: result.students,
        },
        meta: {
          total: result.total,
          teachersCount: result.teachers.length,
          studentsCount: result.students.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/honor-roll/:id
   */
  static async getById(req, res, next) {
    try {
      const entry = await HonorRollService.getById(req.params.id);

      return res.status(200).json({
        status: 'success',
        success: true,
        data: entry,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ③ POST /api/v1/honor-roll
   * Protected: ADMIN, SUPER_ADMIN
   */
  static async create(req, res, next) {
    try {
      const created = await HonorRollService.create(req.body);

      return res.status(201).json({
        status: 'success',
        success: true,
        message: 'تمت إضافة المكرم إلى لوحة الشرف بنجاح',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ④ PUT /api/v1/honor-roll/:id
   * Protected: ADMIN, SUPER_ADMIN
   */
  static async update(req, res, next) {
    try {
      const updated = await HonorRollService.update(req.params.id, req.body);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم تحديث بيانات المكرم بنجاح',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⑤ DELETE /api/v1/honor-roll/:id
   * Protected: ADMIN, SUPER_ADMIN
   */
  static async delete(req, res, next) {
    try {
      const result = await HonorRollService.delete(req.params.id);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم حذف المكرم من لوحة الشرف بنجاح',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/honor-roll/:id/toggle-active
   */
  static async toggleActive(req, res, next) {
    try {
      const updated = await HonorRollService.toggleActive(req.params.id);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: updated.isActive ? 'تم تفعيل ظهور المكرم' : 'تم إخفاء المكرم',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/honor-roll/reorder
   */
  static async reorder(req, res, next) {
    try {
      const result = await HonorRollService.reorder(req.body.items);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default HonorRollController;

