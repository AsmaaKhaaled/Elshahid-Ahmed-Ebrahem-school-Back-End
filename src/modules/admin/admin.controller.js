import { AdminService } from './admin.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class AdminController {
  /**
   * GET /api/v1/admin/admins
   */
  static async getAllAdmins(req, res, next) {
    try {
      const admins = await AdminService.getAllAdmins(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم جلب قائمة المسؤولين بنجاح',
        data: admins,
        meta: { total: admins.length },
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
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم استرجاع بيانات المسؤول بنجاح',
        data: admin,
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
      return ApiResponse.created(res, newAdmin, 'تم إنشاء حساب المسؤول بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/admins/:id
   */
  static async updateAdmin(req, res, next) {
    try {
      const updatedAdmin = await AdminService.updateAdmin(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تحديث بيانات المسؤول بنجاح',
        data: updatedAdmin,
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
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تحديث صلاحيات المسؤول بنجاح',
        data: updatedAdmin,
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
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تحديث حالة حساب المسؤول بنجاح',
        data: updatedAdmin,
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
      return ApiResponse.success(res, {
        statusCode: 200,
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
      return ApiResponse.success(res, {
        statusCode: 200,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdminController;
