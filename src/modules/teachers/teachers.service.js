import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { compareArabic } from '../../shared/utils/arabic.js';
import { parsePagination, buildPaginationMeta } from '../../shared/utils/pagination.js';

const SALT_ROUNDS = 10;

// The school's classes: grade number -> sections (matches the frontend's GRADE_LEVELS)
export const GRADES = [
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

/**
 * Which classes each subject is taught to. Teachers saved before per-subject classes existed
 * teach every subject to all of their classes.
 */
export const assignmentsOf = (teacher, classNames) => {
  const saved = Array.isArray(teacher.teachingAssignments) ? teacher.teachingAssignments : [];
  if (saved.length) return saved;
  return teacher.teachingSubjects.map((subject) => ({ subject, classes: [...classNames].sort() }));
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
  assignments: assignmentsOf(teacher, teacher.classes.map((cls) => cls.name)),
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
  assignments: assignmentsOf(teacher, teacher.classes.map((cls) => cls.name)),
  status: teacher.employmentStatus,
});

const clean = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// ---- The signed-in teacher's own classes (assigned by the admin on the teachers page) ----

// A teacher's classes: the ones they teach, plus the one they advise
const myClassesWhere = (teacherId) => ({
  isActive: true,
  OR: [{ assignedTeachers: { some: { id: teacherId } } }, { classTeacherId: teacherId }],
});

const MY_CLASS_SELECT = {
  id: true,
  name: true,
  displayNameArabic: true,
  gradeLevel: true,
  roomNumber: true,
  capacity: true,
  classTeacherId: true,
  _count: { select: { students: { where: { isActive: true } } } },
};

const toMyClassDto = (cls, teacherId) => ({
  id: cls.id,
  name: cls.name,
  displayNameArabic: cls.displayNameArabic ?? cls.name,
  gradeLevel: cls.gradeLevel,
  roomNumber: cls.roomNumber ?? '',
  capacity: cls.capacity,
  studentCount: cls._count.students,
  isAdvisor: cls.classTeacherId === teacherId,
});

// What a teacher needs about a student in their class (no national ID / address)
const ROSTER_SELECT = {
  id: true,
  studentCode: true,
  fullNameArabic: true,
  gender: true,
  enrollmentStatus: true,
  guardianName: true,
  guardianPhone: true,
};

const toRosterDto = (student) => ({
  id: student.id,
  studentCode: student.studentCode,
  fullName: student.fullNameArabic,
  gender: student.gender,
  enrollmentStatus: student.enrollmentStatus ?? '',
  guardianName: student.guardianName ?? '',
  guardianPhone: student.guardianPhone ?? '',
});

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
    const classIds = await this.resolveClasses(this.assignedClassNames(data));
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
    const classIds = await this.resolveClasses(this.assignedClassNames(data));
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

  /** Every class a teacher can be assigned to: this year's classes (the standard 12 until classes are set up). */
  static async getClassOptions() {
    const active = await prisma.class.findMany({ where: { isActive: true }, select: { name: true } });
    const names = active.length ? active.map((cls) => cls.name) : STANDARD_CLASSES.map((cls) => cls.name);
    return names.sort();
  }

  /** The classes the admin assigned to this teacher, with how many students each has. */
  static async getMyClasses(teacherId) {
    const classes = await prisma.class.findMany({
      where: myClassesWhere(teacherId),
      select: MY_CLASS_SELECT,
      orderBy: { name: 'asc' },
    });
    return classes.map((cls) => toMyClassDto(cls, teacherId));
  }

  /** One page of a class's students (A→Z). The class must be one of the teacher's own. */
  static async getMyClassStudents(teacherId, classId, query) {
    const { page, limit, skip, take } = parsePagination(query, 20, 100);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const where = {
      classId,
      isActive: true,
      ...(search && {
        OR: [
          { fullNameArabic: { contains: search, mode: 'insensitive' } },
          { studentCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // All three in parallel (one wait instead of three); the students are only returned if the class is the teacher's
    const [cls, total, students] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, ...myClassesWhere(teacherId) }, select: MY_CLASS_SELECT }),
      prisma.student.count({ where }),
      prisma.student.findMany({ where, select: ROSTER_SELECT, orderBy: { fullNameArabic: 'asc' }, skip, take }),
    ]);
    if (!cls) {
      throw AppError.notFound('الفصل غير موجود ضمن فصولك');
    }

    return {
      class: toMyClassDto(cls, teacherId),
      students: students.map(toRosterDto),
      meta: buildPaginationMeta({ total, page, limit }),
    };
  }

  // ---- helpers ----

  static teacherData(body) {
    const assignments = this.assignmentsFrom(body);
    return {
      fullNameArabic: body.fullName.trim().replace(/\s+/g, ' '),
      nationalId: body.nationalId.trim(),
      phone: body.phone.trim(),
      email: clean(body.email)?.toLowerCase() ?? null,
      jobTitle: clean(body.jobTitle),
      specialization: body.specialization.trim(),
      teachingSubjects: assignments.map((a) => a.subject),
      teachingAssignments: assignments,
      employmentStatus: body.status,
    };
  }

  /** [{ subject, classes[] }] from the body; without `assignments`, every subject goes to all `classes`. */
  static assignmentsFrom(body) {
    const given = Array.isArray(body.assignments)
      ? body.assignments
      : body.subjects.map((subject) => ({ subject, classes: body.classes }));
    const bySubject = new Map();
    for (const { subject, classes } of given) {
      const name = subject.trim();
      const merged = new Set([...(bySubject.get(name) ?? []), ...classes.map((cls) => cls.trim())]);
      bySubject.set(name, merged);
    }
    return [...bySubject].map(([subject, classes]) => ({ subject, classes: [...classes].sort() }));
  }

  /** Every class the teacher teaches any subject to. */
  static assignedClassNames(data) {
    return [...new Set(data.teachingAssignments.flatMap((a) => a.classes))];
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

  /**
   * Class names -> ids; only this year's (active) classes. While the database has no classes at all,
   * a standard class is created on the way.
   */
  static async resolveClasses(names) {
    const wanted = [...new Set(names.map((name) => name.trim()))];
    if (!wanted.length) return [];

    const found = await prisma.class.findMany({ where: { name: { in: wanted }, isActive: true }, select: { id: true, name: true } });
    const foundNames = new Set(found.map((cls) => cls.name));
    const missing = wanted.filter((name) => !foundNames.has(name));
    if (!missing.length) return found.map((cls) => ({ id: cls.id }));

    const classesSetUp = (await prisma.class.count()) > 0;
    const unknown = missing.filter((name) => classesSetUp || !STANDARD_CLASSES.some((cls) => cls.name === name));
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
