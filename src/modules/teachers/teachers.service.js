import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { compareArabic } from '../../shared/utils/arabic.js';
import { parsePagination, buildPaginationMeta } from '../../shared/utils/pagination.js';
import { assertIdentityFree } from '../auth/accounts.js';
import { normalizeNationalId, normalizePhone } from '../../shared/utils/egyptian-ids.js';

const SALT_ROUNDS = 10;

/** Who sees teachers' national IDs, phones & accounts: SUPER_ADMIN, or an ADMIN with the 'teachers' section */
export const canManageTeachers = (user) =>
  user?.role === 'SUPER_ADMIN' || (user?.role === 'ADMIN' && Array.isArray(user.permissions) && user.permissions.includes('teachers'));

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
  // false = left the school: can't sign in, has no classes, kept for the records
  active: teacher.isActive,
  // Sign-in account for the teachers portal (on the teacher's own row)
  account: { status: teacher.status, mustChangePassword: teacher.forcePasswordChange },
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
  active: teacher.isActive,
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
  /**
   * All teachers, A→Z. Only whoever manages teachers gets national IDs, phones & accounts;
   * teachers and other admins get the reduced view.
   */
  static async getTeachers(viewer) {
    const teachers = await prisma.teacher.findMany({ include: TEACHER_INCLUDE });
    teachers.sort((a, b) => compareArabic(a.fullNameArabic, b.fullNameArabic));
    return teachers.map(canManageTeachers(viewer) ? toDto : toPublicDto);
  }

  static async getTeacherById(id) {
    const teacher = await prisma.teacher.findUnique({ where: { id }, include: TEACHER_INCLUDE });
    if (!teacher) {
      throw AppError.notFound('المعلم غير موجود');
    }
    return toDto(teacher);
  }

  /** Creates the teacher with their portal account on the same row (first sign-in asks for a new password). */
  static async createTeacher(body) {
    const data = this.teacherData(body);
    await this.assertUnique({ nationalId: data.nationalId, email: data.email });
    const classIds = await this.resolveClasses(this.assignedClassNames(data));
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const teacherCode = await this.nextTeacherCode();

    const teacher = await prisma.teacher.create({
      data: {
        ...data,
        teacherCode,
        password: passwordHash,
        role: 'TEACHER',
        forcePasswordChange: true,
        classes: { connect: classIds },
      },
      include: TEACHER_INCLUDE,
    });
    return toDto(teacher);
  }

  /** Updates the teacher; a new password resets the sign-in (the first sign-in asks for a new one again). */
  static async updateTeacher(id, body) {
    const existing = await prisma.teacher.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!existing) {
      throw AppError.notFound('المعلم غير موجود');
    }
    const data = this.teacherData(body);
    if (!existing.isActive && data.teachingAssignments.some((a) => a.classes.length)) {
      throw AppError.badRequest('المعلم غير مفعّل (ترك المدرسة). فعّله الأول قبل ما تسند له فصول');
    }
    await this.assertUnique({ nationalId: data.nationalId, email: data.email, teacherId: id });
    await this.assertScheduleStillTaught(id, data.teachingAssignments);
    const classIds = await this.resolveClasses(this.assignedClassNames(data));
    const passwordHash = body.password ? await bcrypt.hash(body.password, SALT_ROUNDS) : null;

    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        ...data,
        ...(passwordHash && { password: passwordHash, forcePasswordChange: true }),
        classes: { set: classIds },
      },
      include: TEACHER_INCLUDE,
    });
    return toDto(teacher);
  }

  /**
   * Deletes a teacher added by mistake (and their account & timetable periods).
   * A teacher with anything on record (attendance book, grades, students' attendance, exams,
   * materials, announcements, curricula) can't be deleted: they are deactivated instead,
   * so that history keeps pointing at them.
   * @returns how many timetable periods went with them
   */
  static async deleteTeacher(id) {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: {
            attendanceRecords: true,
            recordedGrades: true,
            recordedAttendances: true,
            announcedExams: true,
            uploadedMaterials: true,
            authoredAnnouncements: true,
            curricula: true,
            timetablePeriods: true,
          },
        },
      },
    });
    if (!teacher) {
      throw AppError.notFound('المعلم غير موجود');
    }

    const { timetablePeriods, ...records } = teacher._count;
    const LABELS = {
      attendanceRecords: 'يوم في دفتر حضور المعلمين',
      recordedGrades: 'درجة رصدها',
      recordedAttendances: 'غياب طلاب سجّله',
      announcedExams: 'امتحان',
      uploadedMaterials: 'مادة تعليمية',
      authoredAnnouncements: 'إعلان',
      curricula: 'منهج',
    };
    const found = Object.entries(records)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count} ${LABELS[key]}`);
    if (found.length) {
      throw AppError.conflict(
        `لا يمكن حذف المعلم لأن له سجلات (${found.join('، ')}). استخدم "إيقاف المعلم" بدلاً من الحذف للحفاظ على السجلات`
      );
    }

    await prisma.teacher.delete({ where: { id } });
    return { removedPeriods: timetablePeriods };
  }

  /**
   * A teacher who left the school: can't sign in, leaves their classes, advised classes and timetable,
   * and drops out of the attendance book. Everything they recorded is kept.
   */
  static async deactivateTeacher(id) {
    const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!teacher) {
      throw AppError.notFound('المعلم غير موجود');
    }
    if (!teacher.isActive) {
      throw AppError.badRequest('المعلم موقوف بالفعل');
    }

    const [periods, advised] = await prisma.$transaction([
      prisma.timetablePeriod.deleteMany({ where: { teacherId: id } }),
      prisma.class.updateMany({ where: { classTeacherId: id }, data: { classTeacherId: null } }),
      prisma.teacher.update({
        where: { id },
        data: {
          isActive: false,
          status: 'INACTIVE',
          teachingSubjects: [],
          teachingAssignments: [],
          classes: { set: [] },
        },
      }),
    ]);

    const updated = await prisma.teacher.findUnique({ where: { id }, include: TEACHER_INCLUDE });
    return { teacher: toDto(updated), removedPeriods: periods.count, removedAdvisedClasses: advised.count };
  }

  /** Brings a teacher back: they can sign in again (subjects & classes are assigned again from the form). */
  static async activateTeacher(id) {
    const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!teacher) {
      throw AppError.notFound('المعلم غير موجود');
    }
    if (teacher.isActive) {
      throw AppError.badRequest('المعلم مفعّل بالفعل');
    }
    const updated = await prisma.teacher.update({
      where: { id },
      data: { isActive: true, status: 'ACTIVE' },
      include: TEACHER_INCLUDE,
    });
    return toDto(updated);
  }

  /**
   * A teacher's timetable may only hold what they teach: taking a subject or a class away from them
   * while they still have periods of it in the school's newest term is refused (the timetable is changed
   * first). Older terms are history and don't block anything. Term IDs sort by date ("2026-2027-T1" < "…-T2").
   */
  static async assertScheduleStillTaught(teacherId, assignments) {
    const newest = await prisma.timetablePeriod.aggregate({ _max: { termId: true } });
    const termId = newest._max.termId;
    if (!termId) return;
    const periods = await prisma.timetablePeriod.findMany({
      where: { teacherId, termId },
      select: { subject: true, termId: true, class: { select: { name: true } } },
    });
    if (!periods.length) return;

    const taught = new Set(assignments.flatMap((a) => a.classes.map((cls) => `${a.subject}|${cls}`)));
    const orphaned = new Map();
    for (const p of periods) {
      const key = `${p.subject.trim()}|${p.class.name}`;
      if (!taught.has(key)) orphaned.set(key, (orphaned.get(key) ?? 0) + 1);
    }
    if (!orphaned.size) return;

    const list = [...orphaned].map(([key, count]) => {
      const [subject, className] = key.split('|');
      return `${subject} - فصل ${className} (${count} حصة)`;
    });
    throw AppError.conflict(
      `المعلم عنده حصص في الجدول لمواد/فصول اتشالت منه: ${list.join('، ')}. عدّل جدول المعلم الأول وبعدين احفظ`
    );
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
      nationalId: normalizeNationalId(body.nationalId),
      phone: normalizePhone(body.phone),
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

  /** The national ID / email isn't used by any other account: admin, teacher or student. */
  static async assertUnique({ nationalId, email, teacherId = null }) {
    await assertIdentityFree({ nationalId, email }, { model: 'teacher', id: teacherId });
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
