import { prisma } from '../../config/database.js';

export class AnnouncementModel {
  /**
   * Find all announcements with per-user read tracking
   */
  static async findAll({ role, userId, category, search, includeExpired = false } = {}) {
    const where = {
      isActive: true,
    };

    const todayStr = new Date().toISOString().split('T')[0];

    // Filter out expired announcements for non-admins (unless includeExpired is true)
    if (!includeExpired && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gte: todayStr } },
      ];
    }

    // Role-based visibility
    if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      const roleFilter = {
        OR: [
          { audiences: { has: role } },
          { audiences: { isEmpty: true } },
          { targetAudience: 'ALL' },
          { targetAudience: role === 'TEACHER' ? 'TEACHERS' : role === 'STUDENT' ? 'STUDENTS' : 'PARENTS' },
        ],
      };

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          roleFilter,
        ];
        delete where.OR;
      } else {
        where.AND = [roleFilter];
      }
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      const searchFilter = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.AND) {
        where.AND.push(searchFilter);
      } else {
        where.AND = [searchFilter];
      }
    }

    const announcements = await prisma.announcement.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
        reads: userId
          ? {
              where: { userId },
              select: { id: true, readAt: true },
            }
          : false,
      },
      orderBy: [
        { pinned: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Format with isRead boolean
    return announcements.map((item) => {
      const isRead = Boolean(userId && item.reads && item.reads.length > 0);
      return {
        id: item.id,
        title: item.title,
        content: item.content,
        category: item.category || 'إداري',
        audiences: item.audiences || ['TEACHER', 'STUDENT', 'PARENT'],
        author: item.authorName || item.author?.name || 'إدارة المدرسة',
        publishedAt: item.createdAt.toISOString(),
        expiresAt: item.expiresAt || undefined,
        pinned: item.pinned || false,
        attachment: item.attachmentUrl
          ? { name: item.attachmentName || 'ملف مرفق', url: item.attachmentUrl }
          : undefined,
        type: item.type,
        priority: item.priority,
        classId: item.classId,
        className: item.class?.name || null,
        isRead,
        readAt: isRead ? item.reads[0].readAt : null,
      };
    });
  }

  /**
   * Announcements anyone may read without signing in: school-wide (not a class note),
   * addressed to visitors (الزوار), active and not expired. Only the fields a public page shows.
   */
  static async findPublic() {
    const todayStr = new Date().toISOString().split('T')[0];
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        type: 'SCHOOL_WIDE',
        classId: null,
        OR: [{ audiences: { has: 'PARENT' } }, { audiences: { isEmpty: true } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: todayStr } }] }],
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return announcements.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category || 'إداري',
      audiences: item.audiences?.length ? item.audiences : ['TEACHER', 'STUDENT', 'PARENT'],
      author: item.authorName || 'إدارة المدرسة',
      publishedAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt || undefined,
      pinned: item.pinned || false,
      attachment: item.attachmentUrl
        ? { name: item.attachmentName || 'ملف مرفق', url: item.attachmentUrl }
        : undefined,
    }));
  }

  /**
   * Find announcement by ID with read status
   */
  static async findById(id, userId = null) {
    const item = await prisma.announcement.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
        reads: userId
          ? {
              where: { userId },
              select: { id: true, readAt: true },
            }
          : false,
      },
    });

    if (!item) return null;

    const isRead = Boolean(userId && item.reads && item.reads.length > 0);
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category || 'إداري',
      audiences: item.audiences || ['TEACHER', 'STUDENT', 'PARENT'],
      author: item.authorName || item.author?.name || 'إدارة المدرسة',
      publishedAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt || undefined,
      pinned: item.pinned || false,
      attachment: item.attachmentUrl
        ? { name: item.attachmentName || 'ملف مرفق', url: item.attachmentUrl }
        : undefined,
      type: item.type,
      priority: item.priority,
      classId: item.classId,
      className: item.class?.name || null,
      isRead,
      readAt: isRead ? item.reads[0].readAt : null,
    };
  }

  /**
   * Count unread announcements for a specific user
   */
  static async countUnread(userId, role) {
    if (!userId) return 0;

    const todayStr = new Date().toISOString().split('T')[0];

    const where = {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: todayStr } },
      ],
      reads: {
        none: { userId },
      },
    };

    if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.AND = [
        {
          OR: [
            { audiences: { has: role } },
            { audiences: { isEmpty: true } },
            { targetAudience: 'ALL' },
            { targetAudience: role === 'TEACHER' ? 'TEACHERS' : role === 'STUDENT' ? 'STUDENTS' : 'PARENTS' },
          ],
        },
      ];
    }

    return prisma.announcement.count({ where });
  }

  /**
   * Mark announcement as read by a user
   */
  static async markAsRead(announcementId, userId) {
    return prisma.announcementRead.upsert({
      where: {
        unique_announcement_user_read: {
          announcementId,
          userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId,
        userId,
      },
    });
  }

  /**
   * Mark all targeted announcements as read for a user
   */
  static async markAllAsRead(userId, role) {
    const todayStr = new Date().toISOString().split('T')[0];

    const where = {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: todayStr } },
      ],
      reads: {
        none: { userId },
      },
    };

    if (role && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.AND = [
        {
          OR: [
            { audiences: { has: role } },
            { audiences: { isEmpty: true } },
            { targetAudience: 'ALL' },
          ],
        },
      ];
    }

    const unreadList = await prisma.announcement.findMany({
      where,
      select: { id: true },
    });

    if (unreadList.length === 0) return 0;

    await prisma.announcementRead.createMany({
      data: unreadList.map((a) => ({
        announcementId: a.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return unreadList.length;
  }

  /**
   * Create a new announcement
   */
  static async create(data) {
    let audiences = data.audiences;
    if (typeof audiences === 'string') {
      audiences = [audiences];
    } else if (!Array.isArray(audiences) || audiences.length === 0) {
      audiences = ['TEACHER', 'STUDENT', 'PARENT'];
    }

    // Determine targetAudience enum
    let targetAudience = 'ALL';
    if (audiences.length === 1) {
      if (audiences[0] === 'TEACHER') targetAudience = 'TEACHERS';
      else if (audiences[0] === 'STUDENT') targetAudience = 'STUDENTS';
      else if (audiences[0] === 'PARENT') targetAudience = 'PARENTS';
    }

    return prisma.announcement.create({
      data: {
        title: data.title.trim(),
        content: data.content.trim(),
        category: data.category ? String(data.category).trim() : 'إداري',
        audiences,
        authorName: data.author ? String(data.author).trim() : 'إدارة المدرسة',
        expiresAt: data.expiresAt || null,
        pinned: Boolean(data.pinned),
        attachmentUrl: data.attachment?.url || data.attachmentUrl || null,
        attachmentName: data.attachment?.name || data.attachmentName || null,
        type: data.type ? data.type.toUpperCase() : (data.classId ? 'CLASS_NOTE' : 'SCHOOL_WIDE'),
        targetAudience,
        priority: data.priority ? data.priority.toUpperCase() : (data.category === 'عاجل وهام' ? 'URGENT' : 'MEDIUM'),
        classId: data.classId || null,
        authorId: data.authorId || null,
        authorRole: data.authorRole || 'ADMIN',
        publishDate: data.publishDate || new Date().toISOString().split('T')[0],
      },
      include: {
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  /**
   * Update announcement
   */
  static async update(id, data) {
    const updateData = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.category !== undefined) updateData.category = String(data.category).trim();
    if (data.audiences !== undefined) {
      updateData.audiences = Array.isArray(data.audiences) ? data.audiences : [data.audiences];
    }
    if (data.author !== undefined) updateData.authorName = String(data.author).trim();
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt || null;
    if (data.pinned !== undefined) updateData.pinned = Boolean(data.pinned);
    if (data.attachment !== undefined) {
      updateData.attachmentUrl = data.attachment?.url || null;
      updateData.attachmentName = data.attachment?.name || null;
    }
    if (data.attachmentUrl !== undefined) updateData.attachmentUrl = data.attachmentUrl;
    if (data.attachmentName !== undefined) updateData.attachmentName = data.attachmentName;

    return prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  /**
   * Toggle pinned status
   */
  static async togglePinned(id) {
    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { pinned: true },
    });
    if (!existing) return null;

    return prisma.announcement.update({
      where: { id },
      data: { pinned: !existing.pinned },
    });
  }

  /**
   * Delete announcement
   */
  static async delete(id) {
    await prisma.announcement.delete({
      where: { id },
    });
    return true;
  }
}

export default AnnouncementModel;
