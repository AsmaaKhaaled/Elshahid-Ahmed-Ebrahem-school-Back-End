import { AdminService } from './admin.service.js';

export class AdminController {
  /**
   * GET /api/v1/admin/admins
   */
  static async getAllAdmins(req, res, next) {
    try {
      const admins = await AdminService.getAllAdmins(req.query);
      return res.status(200).json({
        status: 'success',
        results: admins.length,
        data: { admins },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/admins/:id
   */
  static async getAdminById(req, res, next) {
    try {
      const admin = await AdminService.getAdminById(req.params.id);
      return res.status(200).json({
        status: 'success',
        data: { admin },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/admins
   */
  static async createAdmin(req, res, next) {
    try {
      const newAdmin = await AdminService.createAdmin(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'تم إنشاء حساب المسؤول بنجاح',
        data: { admin: newAdmin },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id/permissions
   */
  static async updatePermissions(req, res, next) {
    try {
      const updatedAdmin = await AdminService.updatePermissions(req.params.id, req.body.permissions);
      return res.status(200).json({
        status: 'success',
        message: 'تم تحديث صلاحيات المسؤول بنجاح',
        data: { admin: updatedAdmin },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id/status
   */
  static async updateStatus(req, res, next) {
    try {
      const updatedAdmin = await AdminService.updateStatus(req.params.id, req.body.status);
      return res.status(200).json({
        status: 'success',
        message: 'تم تحديث حالة حساب المسؤول بنجاح',
        data: { admin: updatedAdmin },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id/reset-password
   */
  static async resetPassword(req, res, next) {
    try {
      const result = await AdminService.resetPassword(req.params.id, req.body.newPassword);
      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/admins/:id
   */
  static async deleteAdmin(req, res, next) {
    try {
      const result = await AdminService.deleteAdmin(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdminController;

