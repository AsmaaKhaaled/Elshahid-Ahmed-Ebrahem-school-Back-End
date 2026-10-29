import { AuthService } from './auth.service.js';

export class AuthController {
  /**
   * POST /api/v1/auth/login
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
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getMe(req.user.id);
      return res.status(200).json({
        status: 'success',
        user,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
