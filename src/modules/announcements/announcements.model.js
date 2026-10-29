import { prisma } from '../../config/database.js';

export class AnnouncementModel {
  static async findAll({ targetAudience, priority, type, classId } = {}) {
    const where = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (classId) {
      where.OR = [{ classId }, { classId: null }, { type: 'SCHOOL_WIDE' }];
    }

    if (targetAudience) {
      where.OR = [
        { targetAudience: 'ALL' },
        { targetAudience: targetAudience.toUpperCase() },
      ];
    }

    if (priority) {
      where.priority = priority.toUpperCase();
    }

    return prisma.announcement.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id) {
    return prisma.announcement.findUnique({
      where: { id },
      include: {
        class: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  static async create(data) {
    return prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        type: data.type ? data.type.toUpperCase() : (data.classId ? 'CLASS_NOTE' : 'SCHOOL_WIDE'),
        targetAudience: data.targetAudience ? data.targetAudience.toUpperCase() : 'ALL',
        priority: data.priority ? data.priority.toUpperCase() : 'MEDIUM',
        classId: data.classId || null,
        authorId: data.authorId || null,
        authorRole: data.authorRole || 'ADMIN',
        publishDate: data.publishDate || new Date().toISOString().split('T')[0],
      },
      include: {
        class: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  static async update(id, data) {
    const updateData = { ...data };
    if (updateData.type) {
      updateData.type = updateData.type.toUpperCase();
    }
    if (updateData.targetAudience) {
      updateData.targetAudience = updateData.targetAudience.toUpperCase();
    }
    if (updateData.priority) {
      updateData.priority = updateData.priority.toUpperCase();
    }

    return prisma.announcement.update({
      where: { id },
      data: updateData,
      include: {
        class: true,
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  static async delete(id) {
    await prisma.announcement.delete({
      where: { id },
    });
    return true;
  }
}

export default AnnouncementModel;
