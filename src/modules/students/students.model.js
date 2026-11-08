import { prisma } from '../../config/database.js';
import { GRADES } from '../teachers/teachers.service.js';

const LIST_CLASS_SELECT = {
  select: {
    id: true,
    name: true,
    displayNameArabic: true,
    gradeLevel: true,
    roomNumber: true,
  },
};

/** 'الصف الثاني الإعدادي' / '2nd Preparatory' / '2' -> the grade, for filtering */
const gradeOfFilter = (value) => {
  const text = String(value || '').trim();
  return GRADES.find((g) => text === String(g.number) || text === g.level || text === g.label);
};

export class StudentModel {
  /**
   * The next free student code: STD-<year>-<number> (e.g. STD-2026-006).
   * Compared as numbers, so STD-2026-1000 comes after STD-2026-999.
   */
  static async getNextStudentCode() {
    const prefix = `STD-${new Date().getFullYear()}-`;
    const codes = await prisma.student.findMany({
      where: { studentCode: { startsWith: prefix } },
      select: { studentCode: true },
    });
    const highest = codes.reduce((max, { studentCode }) => {
      const n = Number(studentCode.slice(prefix.length));
      return Number.isInteger(n) && n > max ? n : max;
    }, 0);
    return `${prefix}${String(highest + 1).padStart(3, '0')}`;
  }

  /**
   * Filters: classId, classIds (a teacher's classes), gradeLevel, enrollmentStatus, search,
   * withoutClass ('true': students not in any class), activeOnly; page & limit to paginate.
   * `select`: the fields to return (a teacher's reduced view); the full row otherwise.
   */
  static async findAll(
    { classId, classIds, gradeLevel, enrollmentStatus, search, withoutClass, activeOnly, page, limit } = {},
    select = null
  ) {
    const and = [];

    if (classIds) and.push({ classId: { in: classIds } });
    if (classId) and.push({ classId });
    if (withoutClass === true || withoutClass === 'true') and.push({ classId: null });
    if (activeOnly) and.push({ isActive: true });
    if (enrollmentStatus) and.push({ enrollmentStatus });

    if (gradeLevel) {
      const grade = gradeOfFilter(gradeLevel);
      and.push(
        grade
          ? {
              OR: [
                { gradeLevel: { in: [grade.label, grade.level] } },
                { class: { name: { startsWith: `${grade.number}/` } } },
              ],
            }
          : { gradeLevel: { contains: String(gradeLevel), mode: 'insensitive' } }
      );
    }

    if (search) {
      const term = String(search).trim();
      and.push({
        OR: [
          { fullNameArabic: { contains: term, mode: 'insensitive' } },
          { fullNameEnglish: { contains: term, mode: 'insensitive' } },
          { studentCode: { contains: term, mode: 'insensitive' } },
          // A teacher's view has no national IDs, so they can't search by them either
          ...(select ? [] : [{ nationalId: { contains: term } }]),
          { guardianName: { contains: term, mode: 'insensitive' } },
          { guardianPhone: { contains: term } },
        ],
      });
    }

    const where = and.length ? { AND: and } : {};
    const total = await prisma.student.count({ where });

    const findArgs = {
      where,
      ...(select ? { select } : { include: { class: LIST_CLASS_SELECT } }),
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
    return prisma.student.findUnique({ where: { id }, include: { class: true } });
  }

  static async findByCode(studentCode) {
    return prisma.student.findUnique({ where: { studentCode }, include: { class: true } });
  }

  static async findByNationalId(nationalId) {
    return prisma.student.findUnique({ where: { nationalId }, include: { class: true } });
  }

  /** `data` is already checked and cleaned by the service */
  static async create(data) {
    return prisma.student.create({
      data: {
        // Sign-in account: no password until the student chooses one (first sign-in: national ID + code)
        role: 'STUDENT',
        status: data.status || 'ACTIVE',
        forcePasswordChange: true,
        studentCode: data.studentCode,
        fullNameArabic: data.fullNameArabic,
        fullNameEnglish: data.fullNameEnglish ?? null,
        nationalId: data.nationalId ?? null,
        gender: data.gender || 'MALE',
        dateOfBirth: data.dateOfBirth ?? null,
        gradeLevel: data.gradeLevel ?? null,
        classId: data.classId ?? null,
        guardianName: data.guardianName ?? null,
        guardianPhone: data.guardianPhone ?? null,
        address: data.address ?? null,
        enrollmentStatus: data.enrollmentStatus || 'منتظم',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: { class: true },
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
      // The account's status follows the enrollment (set by the service, never the password)
      'status',
    ];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    return prisma.student.update({ where: { id }, data: updateData, include: { class: true } });
  }

  static async delete(id) {
    await prisma.student.delete({ where: { id } });
    return true;
  }
}

export default StudentModel;
