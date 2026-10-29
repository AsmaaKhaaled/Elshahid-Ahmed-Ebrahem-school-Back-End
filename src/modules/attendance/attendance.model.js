import { prisma } from '../../config/database.js';

export class AttendanceModel {
  static async findAll({ classId, studentId, date, status } = {}) {
    const where = {};

    if (classId) {
      where.classId = classId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (date) {
      where.date = date;
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    return prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, studentCode: true, fullNameArabic: true } },
        class: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  static async findById(id) {
    return prisma.attendance.findUnique({
      where: { id },
      include: {
        student: true,
        class: true,
        recordedBy: { select: { id: true, name: true } },
      },
    });
  }

  static async create(data) {
    return prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId: data.studentId,
          date: data.date || new Date().toISOString().split('T')[0],
        },
      },
      update: {
        status: data.status ? data.status.toUpperCase() : 'PRESENT',
        remarks: data.remarks || null,
        recordedById: data.recordedById || null,
      },
      create: {
        studentId: data.studentId,
        classId: data.classId,
        date: data.date || new Date().toISOString().split('T')[0],
        status: data.status ? data.status.toUpperCase() : 'PRESENT',
        remarks: data.remarks || null,
        recordedById: data.recordedById || null,
      },
    });
  }

  static async createMany(records) {
    const results = [];
    for (const record of records) {
      const item = await this.create(record);
      results.push(item);
    }
    return results;
  }

  static async update(id, data) {
    const updateData = { ...data };
    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }

    return prisma.attendance.update({
      where: { id },
      data: updateData,
    });
  }

  static async delete(id) {
    await prisma.attendance.delete({
      where: { id },
    });
    return true;
  }
}

export default AttendanceModel;
