import { AnnouncementsService } from './announcements.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class AnnouncementsController {
  /**
   * GET /api/v1/announcements
   */
  static async getAll(req, res, next) {
    try {
      const announcements = await AnnouncementsService.getAnnouncements(req.query, req.user);
      return ApiResponse.success(res, {
        message: 'Announcements retrieved successfully',
        data: announcements,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/announcements/public
   * No sign-in: the announcements addressed to visitors
   */
  static async getPublic(req, res, next) {
    try {
      const announcements = await AnnouncementsService.getPublicAnnouncements();
      return ApiResponse.success(res, {
        message: 'Public announcements retrieved successfully',
        data: announcements,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/announcements/unread-count
   */
  static async getUnreadCount(req, res, next) {
    try {
      const result = await AnnouncementsService.getUnreadCount(req.user);
      return ApiResponse.success(res, {
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/announcements/:id
   */
  static async getById(req, res, next) {
    try {
      const announcement = await AnnouncementsService.getAnnouncementById(req.params.id, req.user);
      return ApiResponse.success(res, {
        data: announcement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/announcements
   * Publish new announcement and broadcast via Socket.io
   */
  static async create(req, res, next) {
    try {
      const created = await AnnouncementsService.createAnnouncement(req.body, req.user);
      return ApiResponse.created(res, created, 'تم نشر التعميم والإعلان وإرسال التنبيهات بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/announcements/:id/read
   * Mark announcement as read
   */
  static async markAsRead(req, res, next) {
    try {
      const result = await AnnouncementsService.markAsRead(req.params.id, req.user);
      return ApiResponse.success(res, {
        message: 'تم تسجيل قراءة الإعلان بنجاح',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/announcements/read-all
   * Mark all unread announcements as read
   */
  static async markAllAsRead(req, res, next) {
    try {
      const result = await AnnouncementsService.markAllAsRead(req.user);
      return ApiResponse.success(res, {
        message: 'تم تعيين جميع الإعلانات كمقروءة',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/announcements/:id/pin
   * Toggle pinned status
   */
  static async togglePinned(req, res, next) {
    try {
      const updated = await AnnouncementsService.togglePinned(req.params.id, req.user);
      return ApiResponse.success(res, {
        message: 'تم تحديث حالة التثبيت بنجاح',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/announcements/:id
   */
  static async update(req, res, next) {
    try {
      const updated = await AnnouncementsService.updateAnnouncement(req.params.id, req.body, req.user);
      return ApiResponse.success(res, {
        message: 'تم تحديث الإعلان بنجاح',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/announcements/:id
   */
  static async remove(req, res, next) {
    try {
      await AnnouncementsService.deleteAnnouncement(req.params.id, req.user);
      return ApiResponse.success(res, {
        message: 'تم حذف الإعلان بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AnnouncementsController;
