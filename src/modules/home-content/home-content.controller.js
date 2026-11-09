import { HomeContentService } from './home-content.service.js';

export class HomeContentController {
  /**
   * GET /api/v1/home-content (Public)
   */
  static async getHomeContent(req, res, next) {
    try {
      const data = await HomeContentService.getHomeContent();

      return res.status(200).json({
        status: 'success',
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ① GET /api/v1/home-content/principal (Public)
   */
  static async getPrincipalWord(req, res, next) {
    try {
      const data = await HomeContentService.getPrincipalWord();

      return res.status(200).json({
        status: 'success',
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ② PUT /api/v1/home-content/principal (Admin Only)
   */
  static async updatePrincipalWord(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const data = await HomeContentService.updatePrincipalWord(req.body, userId);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم تحديث كلمة مدير المدرسة بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default HomeContentController;

