import { prisma } from '../../config/database.js';

export class StudentModel {
  static async findAll({ classId, search } = {}) {
    const where = {};

    if (classId) {
      where.classId = classId;
    }

    if (search) {
      where.OR = [
        { fullNameArabic: { contains: search, mode: 'insensitive' } },
        { fullNameEnglish: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.student.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true, displayNameArabic: true, gradeLevel: true },
        },
      },
      orderBy: { studentCode: 'asc' },
    });
  }

  static async findById(id) {
    return prisma.student.findUnique({
      where: { id },
      include: {
        class: true,
      },
    });
  }

  static async findByCode(studentCode) {
    return prisma.student.findUnique({
      where: { studentCode },
      include: {
        class: true,
      },
    });
  }

  static async create(data) {
    const count = await prisma.student.count();
    const generatedCode = `EAS-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    return prisma.student.create({
      data: {
        studentCode: data.studentCode || generatedCode,
        fullNameArabic: data.fullNameArabic,
        fullNameEnglish: data.fullNameEnglish || null,
        nationalId: data.nationalId || null,
        gender: data.gender || 'MALE',
        dateOfBirth: data.dateOfBirth || null,
        classId: data.classId || null,
        guardianName: data.guardianName || null,
        guardianPhone: data.guardianPhone || null,
        address: data.address || null,
      },
      include: {
        class: true,
      },
    });
  }

  static async createMany(studentsList) {
    const created = [];
    for (const item of studentsList) {
      const student = await this.create(item);
      created.push(student);
    }
    return created;
  }

  static async enrollInClass(id, classId) {
    return prisma.student.update({
      where: { id },
      data: { classId },
      include: {
        class: true,
      },
    });
  }

  static async update(id, data) {
    return prisma.student.update({
      where: { id },
      data,
      include: {
        class: true,
      },
    });
  }

  static async delete(id) {
    await prisma.student.delete({
      where: { id },
    });
    return true;
  }
}

export default StudentModel;
