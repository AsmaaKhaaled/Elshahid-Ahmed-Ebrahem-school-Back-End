import { prisma } from '../../config/database.js';

export class StudentModel {
  /**
   * Helper to generate the next unique student code
   * Format: STD-YYYY-XXX (e.g., STD-2026-006)
   */
  static async getNextStudentCode() {
    const year = new Date().getFullYear();
    const count = await prisma.student.count();
    let nextNum = count + 1;
    let code = `STD-${year}-${String(nextNum).padStart(3, '0')}`;

    // Ensure uniqueness
    while (await prisma.student.findUnique({ where: { studentCode: code } })) {
      nextNum += 1;
      code = `STD-${year}-${String(nextNum).padStart(3, '0')}`;
    }

    return code;
  }

  static async findAll({ classId, gradeLevel, enrollmentStatus, search } = {}) {
    const where = {};

    if (classId) {
      where.classId = classId;
    }

    if (gradeLevel) {
      where.gradeLevel = { contains: gradeLevel, mode: 'insensitive' };
    }

    if (enrollmentStatus) {
      where.enrollmentStatus = enrollmentStatus;
    }

    if (search) {
      where.OR = [
        { fullNameArabic: { contains: search, mode: 'insensitive' } },
        { fullNameEnglish: { contains: search, mode: 'insensitive' } },
        { studentCode: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
        { guardianName: { contains: search, mode: 'insensitive' } },
        { guardianPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.student.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            displayNameArabic: true,
            gradeLevel: true,
            roomNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

  static async findByNationalId(nationalId) {
    return prisma.student.findUnique({
      where: { nationalId },
      include: {
        class: true,
      },
    });
  }

  static async create(data) {
    const generatedCode = await this.getNextStudentCode();

    return prisma.student.create({
      data: {
        userId: data.userId || null,
        studentCode: data.studentCode?.trim() || generatedCode,
        fullNameArabic: data.fullNameArabic.trim(),
        fullNameEnglish: data.fullNameEnglish?.trim() || null,
        nationalId: data.nationalId?.trim() || null,
        gender: data.gender || 'MALE',
        dateOfBirth: data.dateOfBirth || null,
        gradeLevel: data.gradeLevel?.trim() || null,
        classId: data.classId || null,
        guardianName: data.guardianName?.trim() || null,
        guardianPhone: data.guardianPhone?.trim() || null,
        address: data.address?.trim() || null,
        enrollmentStatus: data.enrollmentStatus?.trim() || 'منتظم',
        isActive: data.isActive !== undefined ? data.isActive : true,
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
