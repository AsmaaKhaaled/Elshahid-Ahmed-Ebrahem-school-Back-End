import { prisma } from '../../config/database.js';

export class MaterialModel {
  static whereOf({ subjectId, classId, type, month, search } = {}) {
    const where = {};
    // Each condition is its own AND item: the class filter and the search both need an OR
    const and = [];

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (classId) {
      and.push({ OR: [{ classId }, { classId: null }] });
    }

    if (type) {
      where.type = type.toUpperCase();
    }

    if (month) {
      where.month = { contains: month, mode: 'insensitive' };
    }

    if (search) {
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length) where.AND = and;
    return where;
  }

  static listInclude() {
    return {
      subject: { select: { id: true, code: true, nameArabic: true } },
      class: { select: { id: true, name: true } },
      uploader: { select: { id: true, name: true, role: true } },
      teacherUploader: { select: { id: true, fullNameArabic: true, role: true } },
    };
  }

  static async findAll(filters = {}) {
    return prisma.material.findMany({
      where: this.whereOf(filters),
      include: this.listInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  /** One page of materials, newest first, with the total for the page count. `visible`: what the viewer may see. */
  static async findPage(filters = {}, { skip, take }, visible = {}) {
    // Its own AND item, so the filters can't replace it
    const where = { AND: [visible, this.whereOf(filters)] };
    const [total, items] = await Promise.all([
      prisma.material.count({ where }),
      prisma.material.findMany({
        where,
        include: this.listInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return { total, items };
  }

  static async findById(id) {
    return prisma.material.findUnique({
      where: { id },
      include: {
        subject: true,
        class: true,
        uploader: { select: { id: true, name: true, role: true } },
        teacherUploader: { select: { id: true, fullNameArabic: true, role: true } },
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
        // An admin (users) or a teacher (teachers)
        uploadedById: data.uploadedById || null,
        uploadedByTeacherId: data.uploadedByTeacherId || null,
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
