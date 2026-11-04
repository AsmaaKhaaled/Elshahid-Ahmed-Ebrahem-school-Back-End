import { AnnouncementModel } from './announcements.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { broadcastAnnouncement } from '../../config/socket.js';

export class AnnouncementsService {
  /**
   * Get announcements visible to user with read tracking
   */
  static async getAnnouncements(query, user) {
    const role = user?.role || 'GUEST';
    const userId = user?.id || null;

    return AnnouncementModel.findAll({
      role,
      userId,
      category: query?.category,
      search: query?.search,
      includeExpired: query?.includeExpired === 'true' || query?.includeExpired === true,
    });
  }

  /**
   * Get single announcement by ID
   */
  static async getAnnouncementById(id, user) {
    const userId = user?.id || null;
    const announcement = await AnnouncementModel.findById(id, userId);

    if (!announcement) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    return announcement;
  }

  /**
   * Get unread announcements count for navbar bell badge
   */
  static async getUnreadCount(user) {
    if (!user?.id) return { unreadCount: 0 };
    const count = await AnnouncementModel.countUnread(user.id, user.role);
    return { unreadCount: count };
  }

  /**
   * Mark a specific announcement as read
   */
  static async markAsRead(id, user) {
    if (!user?.id) {
      throw AppError.unauthorized('يجب تسجيل الدخول لتسجيل قراءة الإعلان');
    }

    await this.getAnnouncementById(id, user);
    await AnnouncementModel.markAsRead(id, user.id);

    return {
      success: true,
      announcementId: id,
      isRead: true,
    };
  }

  /**
   * Mark all visible announcements as read
   */
  static async markAllAsRead(user) {
    if (!user?.id) {
      throw AppError.unauthorized('يجب تسجيل الدخول');
    }

    const markedCount = await AnnouncementModel.markAllAsRead(user.id, user.role);

    return {
      success: true,
      markedCount,
      unreadCount: 0,
    };
  }

  /**
   * Create and publish announcement + Broadcast via Socket.io
   */
  static async createAnnouncement(data, user) {
    // Teachers are allowed to post CLASS_NOTE for their classes
    // Admins can post both SCHOOL_WIDE and CLASS_NOTE
    if (user.role === 'TEACHER' && data.type === 'SCHOOL_WIDE') {
      throw AppError.forbidden('المعلمون مصرح لهم بنشر ملاحظات الفصول الخاصة بهم فقط');
    }

    const payload = {
      ...data,
      authorId: user?.id || null,
      authorRole: user?.role || 'ADMIN',
      author: data.author || user?.fullName || 'إدارة المدرسة',
    };

    const created = await AnnouncementModel.create(payload);

    // Format for client
    const formatted = {
      id: created.id,
      title: created.title,
      content: created.content,
      category: created.category,
      audiences: created.audiences,
      author: created.authorName || 'إدارة المدرسة',
      publishedAt: created.createdAt.toISOString(),
      expiresAt: created.expiresAt || undefined,
      pinned: created.pinned,
      attachment: created.attachmentUrl
        ? { name: created.attachmentName || 'ملف مرفق', url: created.attachmentUrl }
        : undefined,
      type: created.type,
      priority: created.priority,
      isRead: true, // Read for the author
    };

    // Auto mark as read for author
    if (user?.id) {
      await AnnouncementModel.markAsRead(created.id, user.id).catch(() => {});
    }

    // Real-time broadcast to all targeted users via Socket.io
    try {
      broadcastAnnouncement(created);
    } catch (socketErr) {
      console.warn('[Socket.io] Realtime broadcast warning:', socketErr.message);
    }

    return formatted;
  }

  /**
   * Update existing announcement
   */
  static async updateAnnouncement(id, data, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    // Teacher can only edit their own announcement
    if (user.role === 'TEACHER' && existing.authorId !== user.id) {
      throw AppError.forbidden('يمكنك تعديل إعلاناتك الخاصة فقط');
    }

    const updated = await AnnouncementModel.update(id, data);
    return AnnouncementModel.findById(updated.id, user.id);
  }

  /**
   * Toggle pinned status of announcement
   */
  static async togglePinned(id, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    await AnnouncementModel.togglePinned(id);
    return AnnouncementModel.findById(id, user.id);
  }

  /**
   * Delete announcement
   */
  static async deleteAnnouncement(id, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    if (user.role === 'TEACHER' && existing.authorId !== user.id) {
      throw AppError.forbidden('يمكنك حذف إعلاناتك الخاصة فقط');
    }

    await AnnouncementModel.delete(id);
    return true;
  }
}

export default AnnouncementsService;
