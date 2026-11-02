import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { compareArabic } from '../../shared/utils/arabic.js';

const SALT_ROUNDS = 10;

// The school's classes: grade number -> sections (matches the frontend's GRADE_LEVELS)
const GRADES = [
  { number: 1, level: '1st Preparatory', label: 'الصف الأول الإعدادي' },
  { number: 2, level: '2nd Preparatory', label: 'الصف الثاني الإعدادي' },
  { number: 3, level: '3rd Preparatory', label: 'الصف الثالث الإعدادي' },
];
const SECTIONS_PER_GRADE = 4;
export const STANDARD_CLASSES = GRADES.flatMap((grade) =>
  Array.from({ length: SECTIONS_PER_GRADE }, (_, i) => ({
    name: `${grade.number}/${i + 1}`,
    gradeLevel: grade.level,
    displayNameArabic: `${grade.label} - فصل ${grade.number}/${i + 1}`,
    roomNumber: `${grade.number}0${i + 1}`,
  }))
);

const TEACHER_INCLUDE = {
  classes: { select: { name: true } },
  user: { select: { id: true, status: true, forcePasswordChange: true } },
};

const toDto = (teacher) => ({
  id: teacher.id,
  teacherCode: teacher.teacherCode,
  fullName: teacher.fullNameArabic,
  nationalId: teacher.nationalId ?? '',
  phone: teacher.phone ?? '',
  email: teacher.email ?? '',
  jobTitle: teacher.jobTitle ?? '',
  specialization: teacher.specialization,
  subjects: teacher.teachingSubjects,
  classes: teacher.classes.map((cls) => cls.name).sort(),
  status: teacher.employmentStatus,
  // Sign-in account for the teachers portal
  account: teacher.user
    ? { status: teacher.user.status, mustChangePassword: teacher.user.forcePasswordChange }
    : null,
});

// What other teachers may see about a colleague (no national ID / phone)
const toPublicDto = (teacher) => ({
  id: teacher.id,
  fullName: teacher.fullNameArabic,
  specialization: teacher.specialization,
  subjects: teacher.teachingSubjects,
  classes: teacher.classes.map((cls) => cls.name).sort(),
  status: teacher.employmentStatus,
});

const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export class TeachersService {
  /** All teachers, A→Z. Teachers get a reduced view of their colleagues. */
  static async getTeachers(viewerRole) {
    const teachers = await prisma.teacher.findMany({ include: TEACHER_INCLUDE });
    teachers.sort((a, b) => compareArabic(a.fullNameArabic, b.fullNameArabic));
    return teachers.map(viewerRole === 'TEACHER' ? toPublicDto : toDto);
  }

  static async getTeacherById(id) {
    const teacher = await prisma.teacher.findUnique({ where: { id }, include: TEACHER_INCLUDE });
    if (!teacher) {
      throw AppError.notFound('المعلم غير موجود');
    }
    return toDto(teacher);
  }

  /** Creates the teacher together with their portal account (first sign-in asks for a new password). */
  static async createTeacher(body) {
    const data = this.teacherData(body);
    await this.assertUnique({ nationalId: data.nationalId, email: data.email });
    const classIds = await this.resolveClasses(body.classes);
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const teacherCode = await this.nextTeacherCode();

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: data.fullNameArabic,
          nationalId: data.nationalId,
          email: data.email,
          phone: data.phone,
          password: passwordHash,
          role: 'TEACHER',
          forcePasswordChange: true,
        },
      });
      return tx.teacher.create({
        data: { ...data, teacherCode, userId: user.id, classes: { connect: classIds } },
        include: TEACHER_INCLUDE,
      });
    });
    return toDto(teacher);
  }

  /** Updates the teacher and keeps their account in sync; a new password resets the sign-in. */
  static async updateTeacher(id, body) {
    const existing = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
    if (!existing) {
      throw AppError.notFound('المعلم غير موجود');
    }
    const data = this.teacherData(body);
    await this.assertUnique({ nationalId: data.nationalId, email: data.email, teacherId: id, userId: existing.userId });
    const classIds = await this.resolveClasses(body.classes);
    const passwordHash = body.password ? await bcrypt.hash(body.password, SALT_ROUNDS) : null;

    const teacher = await prisma.$transaction(async (tx) => {
      let userId = existing.userId;
      const account = { fullName: data.fullNameArabic, nationalId: data.nationalId, email: data.email, phone: data.phone };
      if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: { ...account, ...(passwordHash && { password: passwordHash, forcePasswordChange: true }) },
        });
      } else if (passwordHash) {
        // Teachers added before accounts existed get one when a password is set
        const user = await tx.user.create({ data: { ...account, password: passwordHash, role: 'TEACHER', forcePasswordChange: true } });
        userId = user.id;
      }
      return tx.teacher.update({
        where: { id },
        data: { ...data, userId, classes: { set: classIds } },
        include: TEACHER_INCLUDE,
      });
    });
    return toDto(teacher);
  }

  /**
   * Removes the teacher and their account. Their attendance book rows keep the name,
   * and classes they advised / timetable slots are simply left without a teacher.
   */
  static async deleteTeacher(id) {
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('المعلم غير موجود');
    }
    await prisma.$transaction([
      prisma.teacher.delete({ where: { id } }),
      ...(existing.userId ? [prisma.user.delete({ where: { id: existing.userId } })] : []),
    ]);
  }

  /** Every class a teacher can be assigned to (the standard 12, plus any extra ones in the database). */
  static async getClassOptions() {
    const extra = await prisma.class.findMany({ where: { isActive: true }, select: { name: true } });
    const names = new Set([...STANDARD_CLASSES.map((cls) => cls.name), ...extra.map((cls) => cls.name)]);
    return [...names].sort();
  }

  // ---- helpers ----

  static teacherData(body) {
    return {
      fullNameArabic: body.fullName.trim().replace(/\s+/g, ' '),
      nationalId: body.nationalId.trim(),
      phone: body.phone.trim(),
      email: clean(body.email)?.toLowerCase() ?? null,
      jobTitle: clean(body.jobTitle),
      specialization: body.specialization.trim(),
      teachingSubjects: [...new Set(body.subjects.map((subject) => subject.trim()))],
      employmentStatus: body.status,
    };
  }

  static async assertUnique({ nationalId, email, teacherId = null, userId = null }) {
    const [teacherWithId, userWithId, userWithEmail] = await Promise.all([
      prisma.teacher.findFirst({ where: { nationalId, ...(teacherId && { id: { not: teacherId } }) } }),
      prisma.user.findFirst({ where: { nationalId, ...(userId && { id: { not: userId } }) } }),
      email ? prisma.user.findFirst({ where: { email, ...(userId && { id: { not: userId } }) } }) : null,
    ]);
    if (teacherWithId || userWithId) {
      throw AppError.conflict('الرقم القومي مسجل بالفعل لحساب آخر');
    }
    if (userWithEmail) {
      throw AppError.conflict('البريد الإلكتروني مسجل بالفعل لحساب آخر');
    }
  }

  /** Class names -> ids. A standard class missing from the database is created on the way. */
  static async resolveClasses(names) {
    const wanted = [...new Set(names.map((name) => name.trim()))];
    if (!wanted.length) return [];

    const found = await prisma.class.findMany({ where: { name: { in: wanted } }, select: { id: true, name: true } });
    const foundNames = new Set(found.map((cls) => cls.name));
    const missing = wanted.filter((name) => !foundNames.has(name));

    const unknown = missing.filter((name) => !STANDARD_CLASSES.some((cls) => cls.name === name));
    if (unknown.length) {
      throw AppError.badRequest(`فصول غير موجودة: ${unknown.join('، ')}`);
    }
    if (missing.length) {
      await prisma.class.createMany({
        data: STANDARD_CLASSES.filter((cls) => missing.includes(cls.name)),
        skipDuplicates: true,
      });
    }

    const all = missing.length
      ? await prisma.class.findMany({ where: { name: { in: wanted } }, select: { id: true } })
      : found;
    return all.map((cls) => ({ id: cls.id }));
  }

  // TCH-001, TCH-002... (the highest existing number + 1, so deleted codes are never reused)
  static async nextTeacherCode() {
    const codes = await prisma.teacher.findMany({ where: { teacherCode: { startsWith: 'TCH-' } }, select: { teacherCode: true } });
    const highest = codes.reduce((max, { teacherCode }) => Math.max(max, Number(teacherCode.slice(4)) || 0), 0);
    return `TCH-${String(highest + 1).padStart(3, '0')}`;
  }
}

export default TeachersService;
