import { prisma } from '../../config/database.js';

export class TeacherModel {
  static async findAll({ specialization, search } = {}) {
    const where = {};

    if (specialization) {
      where.specialization = { contains: specialization, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { fullNameArabic: { contains: search, mode: 'insensitive' } },
        { fullNameEnglish: { contains: search, mode: 'insensitive' } },
        { teacherCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.teacher.findMany({
      where,
      include: {
        subjects: true,
        classes: true,
      },
      orderBy: { teacherCode: 'asc' },
    });
  }

  static async findById(id) {
    return prisma.teacher.findUnique({
      where: { id },
      include: {
        subjects: true,
        classes: true,
        supervisedClasses: true,
      },
    });
  }

  static async findByCode(teacherCode) {
    return prisma.teacher.findUnique({
      where: { teacherCode },
      include: {
        subjects: true,
        classes: true,
      },
    });
  }

  static async create(data) {
    const count = await prisma.teacher.count();
    const generatedCode = `TCH-${String(count + 1).padStart(3, '0')}`;

    const subjectConnect = (data.assignedSubjectIds || []).map((id) => ({ id }));
    const classConnect = (data.assignedClassIds || []).map((id) => ({ id }));

    return prisma.teacher.create({
      data: {
        userId: data.userId || null,
        teacherCode: data.teacherCode || generatedCode,
        fullNameArabic: data.fullNameArabic,
        fullNameEnglish: data.fullNameEnglish || null,
        nationalId: data.nationalId || null,
        specialization: data.specialization || 'General',
        email: data.email || null,
        phone: data.phone || null,
        hireDate: data.hireDate || null,
        subjects: {
          connect: subjectConnect,
        },
        classes: {
          connect: classConnect,
        },
      },
      include: {
        subjects: true,
        classes: true,
      },
    });
  }

  static async update(id, data) {
    const { assignedSubjectIds, assignedClassIds, ...rest } = data;
    const updatePayload = { ...rest };

    if (Array.isArray(assignedSubjectIds)) {
      updatePayload.subjects = {
        set: assignedSubjectIds.map((sId) => ({ id: sId })),
      };
    }

    if (Array.isArray(assignedClassIds)) {
      updatePayload.classes = {
        set: assignedClassIds.map((cId) => ({ id: cId })),
      };
    }

    return prisma.teacher.update({
      where: { id },
      data: updatePayload,
      include: {
        subjects: true,
        classes: true,
      },
    });
  }

  static async assignSubjects(id, assignedSubjectIds) {
    return prisma.teacher.update({
      where: { id },
      data: {
        subjects: {
          set: assignedSubjectIds.map((sId) => ({ id: sId })),
        },
      },
      include: {
        subjects: true,
        classes: true,
      },
    });
  }

  static async assignClasses(id, assignedClassIds) {
    return prisma.teacher.update({
      where: { id },
      data: {
        classes: {
          set: assignedClassIds.map((cId) => ({ id: cId })),
        },
      },
      include: {
        subjects: true,
        classes: true,
      },
    });
  }

  static async delete(id) {
    await prisma.teacher.delete({
      where: { id },
    });
    return true;
  }
}

export default TeacherModel;
