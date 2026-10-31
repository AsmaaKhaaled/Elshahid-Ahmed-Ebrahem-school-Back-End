import { AuthService } from './auth.service.js';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   * Unified Login for Admin, Teacher, and Student
   */
  static async login(req, res, next) {
    try {
      const result = await AuthService.login(req.body);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/auth/set-initial-password
   * Sets new password for users with forcePasswordChange === true
   */
  static async setInitialPassword(req, res, next) {
    try {
      const { newPassword } = req.body;
      const result = await AuthService.setInitialPassword(req.user.id, newPassword);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns current authenticated user session and active profile
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user.id);
      return res.status(200).json({
        status: 'success',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/auth/me
   * Updates the signed-in admin's own account details
   */
  static async updateMe(req, res, next) {
    try {
      const user = await AuthService.updateProfile(req.user.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'تم حفظ بيانات الحساب بنجاح',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/auth/change-password
   * Changes the signed-in user's password (requires the current one)
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
