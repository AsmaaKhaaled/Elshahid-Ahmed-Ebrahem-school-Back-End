import { prisma } from '../../config/database.js';

export class TimetableModel {
  static async findAll({ classId, teacherId, dayOfWeek } = {}) {
    const where = {};

    if (classId) {
      where.classId = classId;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (dayOfWeek) {
      where.dayOfWeek = dayOfWeek.toUpperCase();
    }

    return prisma.timetable.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, code: true, nameArabic: true } },
        teacher: { select: { id: true, teacherCode: true, fullNameArabic: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  static async findById(id) {
    return prisma.timetable.findUnique({
      where: { id },
      include: {
        class: true,
        subject: true,
        teacher: true,
      },
    });
  }

  static async create(data) {
    return prisma.timetable.create({
      data: {
        dayOfWeek: data.dayOfWeek.toUpperCase(),
        periodNumber: Number(data.periodNumber),
        startTime: data.startTime,
        endTime: data.endTime,
        classId: data.classId,
        subjectId: data.subjectId,
        teacherId: data.teacherId || null,
      },
      include: {
        class: true,
        subject: true,
        teacher: true,
      },
    });
  }

  static async update(id, data) {
    const updateData = { ...data };
    if (updateData.dayOfWeek) {
      updateData.dayOfWeek = updateData.dayOfWeek.toUpperCase();
    }
    if (updateData.periodNumber !== undefined) {
      updateData.periodNumber = Number(updateData.periodNumber);
    }

    return prisma.timetable.update({
      where: { id },
      data: updateData,
      include: {
        class: true,
        subject: true,
        teacher: true,
      },
    });
  }

  static async delete(id) {
    await prisma.timetable.delete({
      where: { id },
    });
    return true;
  }
}

export default TimetableModel;
