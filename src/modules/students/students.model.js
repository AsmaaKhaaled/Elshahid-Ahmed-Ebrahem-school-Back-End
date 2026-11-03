import { prisma } from '../../config/database.js';

export class StudentModel {
  /**
   * Helper to generate the next unique student code
   * Format: STD-YYYY-XXX (e.g., STD-2026-006)
   */
  static async getNextStudentCode() {
    const year = new Date().getFullYear();
    const latestStudent = await prisma.student.findFirst({
      where: {
        studentCode: {
          startsWith: `STD-${year}-`,
        },
      },
      orderBy: {
        studentCode: 'desc',
      },
      select: {
        studentCode: true,
      },
    });

    let nextNum = 1;
    if (latestStudent && latestStudent.studentCode) {
      const match = latestStudent.studentCode.match(/STD-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    let code = `STD-${year}-${String(nextNum).padStart(3, '0')}`;
    while (await prisma.student.findUnique({ where: { studentCode: code } })) {
      nextNum += 1;
      code = `STD-${year}-${String(nextNum).padStart(3, '0')}`;
    }

    return code;
  }

  static async findAll({ classId, gradeLevel, enrollmentStatus, search, page, limit } = {}) {
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

    const total = await prisma.student.count({ where });

    const findArgs = {
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
    };

    if (page !== undefined || limit !== undefined) {
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      findArgs.skip = (p - 1) * l;
      findArgs.take = l;
    }

    const students = await prisma.student.findMany(findArgs);

    return { students, total };
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
    const allowed = [
      'studentCode',
      'fullNameArabic',
      'fullNameEnglish',
      'nationalId',
      'gender',
      'dateOfBirth',
      'gradeLevel',
      'classId',
      'guardianName',
      'guardianPhone',
      'address',
      'enrollmentStatus',
      'isActive',
    ];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    return prisma.student.update({
      where: { id },
      data: updateData,
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
