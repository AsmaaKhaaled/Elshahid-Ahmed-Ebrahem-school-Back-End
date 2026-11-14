import { prisma } from '../../config/database.js';
import { AppError } from '../errors/app-error.js';
import { assignmentsOf } from '../../modules/teachers/teachers.service.js';

/**
 * What a signed-in teacher may work on, as the admin assigned it on the teachers page:
 * - bySubject: subject name -> ids of the classes they teach it to (grades, materials)
 * - ownClassIds: the classes they teach any subject to, plus the class they advise (attendance)
 * Anyone else gets null: the administration isn't limited, students & parents have their own rules.
 */
export const teachingScopeOf = async (user) => {
  if (user?.role !== 'TEACHER') return null;
  const teacherId = user.teacherProfile?.id;
  const teacher = teacherId
    ? await prisma.teacher.findUnique({
        where: { id: teacherId },
        select: {
          teachingSubjects: true,
          teachingAssignments: true,
          classes: { select: { id: true, name: true } },
          supervisedClasses: { select: { id: true } },
        },
      })
    : null;
  if (!teacher) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');

  const idByName = new Map(teacher.classes.map((cls) => [cls.name, cls.id]));
  const bySubject = new Map(
    assignmentsOf(teacher, [...idByName.keys()]).map((a) => [
      a.subject,
      new Set(a.classes.map((name) => idByName.get(name)).filter(Boolean)),
    ])
  );
  const ownClassIds = new Set([...idByName.values(), ...teacher.supervisedClasses.map((cls) => cls.id)]);
  return { bySubject, ownClassIds };
};

export const teachesSubjectInClass = (scope, subjectName, classId) => scope.bySubject.get(subjectName)?.has(classId) ?? false;

/** The classes this teacher teaches this subject to, as the admin assigned them (assignments, materials). */
export const classesTeachingSubject = async (teacherId, subject) => {
  const [teacher, classes] = await Promise.all([
    prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { teachingSubjects: true, teachingAssignments: true, specialization: true },
    }),
    prisma.class.findMany({
      where: { isActive: true, OR: [{ assignedTeachers: { some: { id: teacherId } } }, { classTeacherId: teacherId }] },
      select: { id: true, name: true },
    }),
  ]);
  if (!teacher) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');

  const subjects = teacher.teachingSubjects.length ? teacher.teachingSubjects : [teacher.specialization];
  if (!subjects.includes(subject)) throw AppError.badRequest('هذه المادة ليست من المواد التي تدرّسها');

  // All the teacher's classes for records saved before per-subject classes existed
  const names = assignmentsOf(teacher, classes.map((cls) => cls.name)).find((a) => a.subject === subject)?.classes;
  const taught = names?.length ? classes.filter((cls) => names.includes(cls.name)) : classes;
  if (!taught.length) throw AppError.badRequest('لا توجد فصول مسجلة لك بعد، اطلب من الإدارة تعيين فصولك');
  return taught;
};

export const isAdminRole = (user) => user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

/** The class a signed-in student is enrolled in (null if none). */
export const studentClassIdOf = (user) => user?.studentProfile?.classId ?? null;
