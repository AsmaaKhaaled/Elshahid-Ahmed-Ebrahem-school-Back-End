import { prisma } from '../../config/database.js';

export class MaterialModel {
  static async findAll({ subjectId, classId, type, month, search } = {}) {
    const where = {};

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (classId) {
      where.OR = [{ classId }, { classId: null }];
    }

    if (type) {
      where.type = type.toUpperCase();
    }

    if (month) {
      where.month = { contains: month, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.material.findMany({
      where,
      include: {
        subject: { select: { id: true, code: true, nameArabic: true } },
        class: { select: { id: true, name: true } },
        uploader: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id) {
    return prisma.material.findUnique({
      where: { id },
      include: {
        subject: true,
        class: true,
        uploader: { select: { id: true, name: true, role: true } },
      },
    });
  }

  static async create(data) {
    return prisma.material.create({
      data: {
        title: data.title,
        type: data.type ? data.type.toUpperCase() : 'SYLLABUS_PDF',
        subjectId: data.subjectId,
        classId: data.classId || null,
        month: data.month || null,
        fileUrl: data.fileUrl,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        description: data.description || null,
        uploadedById: data.uploadedById || null,
      },
      include: {
        subject: true,
        class: true,
      },
    });
  }

  static async update(id, data) {
    const updateData = { ...data };
    if (updateData.type) {
      updateData.type = updateData.type.toUpperCase();
    }

    return prisma.material.update({
      where: { id },
      data: updateData,
      include: {
        subject: true,
        class: true,
      },
    });
  }

  static async delete(id) {
    await prisma.material.delete({
      where: { id },
    });
    return true;
  }
}

export default MaterialModel;
