import { AnnouncementModel } from './announcements.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AnnouncementsService {
  static async getAnnouncements(query) {
    return AnnouncementModel.findAll(query);
  }

  static async getAnnouncementById(id) {
    const announcement = await AnnouncementModel.findById(id);
    if (!announcement) {
      throw AppError.notFound(`Announcement with id '${id}' not found`);
    }
    return announcement;
  }

  static async createAnnouncement(data) {
    // Teachers are allowed to post CLASS_NOTE for their classes
    // Admins can post both SCHOOL_WIDE and CLASS_NOTE
    if (data.authorRole === 'TEACHER' && data.type === 'SCHOOL_WIDE') {
      throw AppError.forbidden('Teachers are only authorized to post class notes, not school-wide events');
    }

    return AnnouncementModel.create(data);
  }

  static async updateAnnouncement(id, data, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`Announcement with id '${id}' not found`);
    }

    // Teacher can only edit their own announcement
    if (user.role === 'TEACHER' && existing.authorId !== user.id) {
      throw AppError.forbidden('You can only update your own announcements');
    }

    const updated = await AnnouncementModel.update(id, data);
    return updated;
  }

  static async deleteAnnouncement(id, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`Announcement with id '${id}' not found`);
    }

    // Teacher can only delete their own announcement
    if (user.role === 'TEACHER' && existing.authorId !== user.id) {
      throw AppError.forbidden('You can only delete your own announcements');
    }

    const deleted = await AnnouncementModel.delete(id);
    return true;
  }
}

export default AnnouncementsService;
