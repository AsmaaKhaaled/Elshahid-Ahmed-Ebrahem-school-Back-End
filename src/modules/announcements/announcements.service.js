import { prisma } from '../../config/database.js';
import { AnnouncementModel } from './announcements.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { broadcastAnnouncement } from '../../config/socket.js';
import { doneBy, readerOf } from '../auth/accounts.js';

// A teacher manages only the announcements they wrote
const assertOwnAnnouncement = async (id, user, message) => {
  if (user.role !== 'TEACHER') return;
  const row = await prisma.announcement.findUnique({ where: { id }, select: { authorTeacherId: true } });
  if (row?.authorTeacherId !== user.id) {
    throw AppError.forbidden(message);
  }
};

export class AnnouncementsService {
  /**
   * Get announcements visible to user with read tracking
   */
  static async getAnnouncements(query, user) {
    const role = user?.role || 'GUEST';

    return AnnouncementModel.findAll({
      role,
      reader: readerOf(user),
      category: query?.category,
      search: query?.search,
      includeExpired: query?.includeExpired === 'true' || query?.includeExpired === true,
    });
  }

  /**
   * Announcements for visitors of the public pages (no sign-in needed)
   */
  static async getPublicAnnouncements() {
    return AnnouncementModel.findPublic();
  }

  /**
   * Get single announcement by ID
   */
  static async getAnnouncementById(id, user) {
    const announcement = await AnnouncementModel.findById(id, readerOf(user));

    if (!announcement) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    return announcement;
  }

  /**
   * Get unread announcements count for navbar bell badge
   */
  static async getUnreadCount(user) {
    const reader = readerOf(user);
    if (!reader) return { unreadCount: 0 };
    const count = await AnnouncementModel.countUnread(reader, user.role);
    return { unreadCount: count };
  }

  /**
   * Mark a specific announcement as read
   */
  static async markAsRead(id, user) {
    const reader = readerOf(user);
    if (!reader) {
      throw AppError.unauthorized('يجب تسجيل الدخول لتسجيل قراءة الإعلان');
    }

    await this.getAnnouncementById(id, user);
    await AnnouncementModel.markAsRead(id, reader);

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
    const reader = readerOf(user);
    if (!reader) {
      throw AppError.unauthorized('يجب تسجيل الدخول');
    }

    const markedCount = await AnnouncementModel.markAllAsRead(reader, user.role);

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
      // An admin (users) or a teacher (teachers)
      ...doneBy(user, 'authorId', 'authorTeacherId'),
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
    const reader = readerOf(user);
    if (reader) {
      await AnnouncementModel.markAsRead(created.id, reader).catch(() => {});
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
    await assertOwnAnnouncement(id, user, 'يمكنك تعديل إعلاناتك الخاصة فقط');

    const updated = await AnnouncementModel.update(id, data);
    return AnnouncementModel.findById(updated.id, readerOf(user));
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
    return AnnouncementModel.findById(id, readerOf(user));
  }

  /**
   * Delete announcement
   */
  static async deleteAnnouncement(id, user) {
    const existing = await AnnouncementModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الإعلان ذو المعرف '${id}' غير موجود`);
    }

    await assertOwnAnnouncement(id, user, 'يمكنك حذف إعلاناتك الخاصة فقط');

    await AnnouncementModel.delete(id);
    return true;
  }
}

export default AnnouncementsService;
