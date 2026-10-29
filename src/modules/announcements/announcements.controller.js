import { AnnouncementsService } from './announcements.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class AnnouncementsController {
  static async getAll(req, res, next) {
    try {
      const announcements = await AnnouncementsService.getAnnouncements(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Announcements retrieved successfully',
        data: announcements,
        meta: { total: announcements.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const announcement = await AnnouncementsService.getAnnouncementById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Announcement retrieved successfully',
        data: announcement,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const payload = {
        ...req.body,
        authorId: req.user.id,
        authorRole: req.user.role,
      };
      const announcement = await AnnouncementsService.createAnnouncement(payload);
      return ApiResponse.created(res, announcement, 'Announcement published successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await AnnouncementsService.updateAnnouncement(req.params.id, req.body, req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Announcement updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await AnnouncementsService.deleteAnnouncement(req.params.id, req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Announcement deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AnnouncementsController;
