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

  // ==========================================
  // School Gallery Slides (صور أنشطة المدرسة)
  // ==========================================

  /**
   * ① GET /api/v1/home-content/gallery (Public & Admin)
   */
  static async getGallerySlides(req, res, next) {
    try {
      const includeHidden = req.query.includeHidden;
      const data = await HomeContentService.getGallerySlides({ includeHidden });

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
   * ② POST /api/v1/home-content/gallery (Admin Only)
   */
  static async createGallerySlide(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const data = await HomeContentService.createGallerySlide(req.body, userId);

      return res.status(201).json({
        status: 'success',
        success: true,
        message: 'تم إضافة صورة النشاط بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ③ PUT /api/v1/home-content/gallery/:id (Admin Only)
   */
  static async updateGallerySlide(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const data = await HomeContentService.updateGallerySlide(req.params.id, req.body, userId);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم تعديل بيانات الصورة بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ④ PATCH /api/v1/home-content/gallery/:id/toggle-hidden (Admin Only)
   */
  static async toggleHidden(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      const data = await HomeContentService.toggleHidden(req.params.id, userId);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم تغيير حالة ظهور الصورة بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⑤ PUT /api/v1/home-content/gallery/reorder (Admin Only)
   */
  static async reorderGallerySlides(req, res, next) {
    try {
      const userId = req.user?.id || req.user?.userId;
      await HomeContentService.reorderGallerySlides(req.body.slideIds, userId);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم إعادة ترتيب الصور بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⑥ DELETE /api/v1/home-content/gallery/:id (Admin Only)
   */
  static async deleteGallerySlide(req, res, next) {
    try {
      const data = await HomeContentService.deleteGallerySlide(req.params.id);

      return res.status(200).json({
        status: 'success',
        success: true,
        message: 'تم حذف صورة النشاط بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default HomeContentController;

