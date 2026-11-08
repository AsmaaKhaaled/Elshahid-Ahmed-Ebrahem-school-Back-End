import { prisma } from '../../config/database.js';
import { GradeModel } from './grades.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { isAdminRole, teachesSubjectInClass, teachingScopeOf } from '../../shared/utils/teaching-scope.js';

// ---- A teacher records & sees grades only for the subjects they teach, in the classes they teach them to
// ---- (as the admin assigned them on the teachers page). A student sees their own. The administration: all.

const assertTeaches = async (user, classId, subjectId) => {
  const scope = await teachingScopeOf(user);
  if (!scope) return;
  const [cls, subject] = await Promise.all([
    classId ? prisma.class.findUnique({ where: { id: classId }, select: { name: true } }) : null,
    subjectId ? prisma.subject.findUnique({ where: { id: subjectId }, select: { nameArabic: true } }) : null,
  ]);
  if (!cls || !subject) {
    throw AppError.forbidden('لا يمكنك رصد درجات إلا لمادتك في فصولك');
  }
  if (!scope.bySubject.has(subject.nameArabic)) {
    throw AppError.forbidden(`لا يمكنك رصد درجات مادة ${subject.nameArabic} لأنك لا تدرّسها`);
  }
  if (!teachesSubjectInClass(scope, subject.nameArabic, classId)) {
    throw AppError.forbidden(`لا تدرّس مادة ${subject.nameArabic} لفصل ${cls.name}`);
  }
};

/** Which grades the viewer may see, as a Prisma condition. */
const visibleGradesWhere = async (user) => {
  if (isAdminRole(user)) return {};
  if (user?.role === 'STUDENT') return { studentId: user.studentProfile?.id ?? '__none__' };
  const scope = await teachingScopeOf(user);
  if (!scope) throw AppError.forbidden('غير مصرح لك بالاطلاع على الدرجات');
  // Their subject, in the classes they teach it to (an empty OR matches nothing)
  return {
    OR: [...scope.bySubject].map(([subject, classIds]) => ({
      subject: { nameArabic: subject },
      exam: { classId: { in: [...classIds] } },
    })),
  };
};

// The students a teacher grades for an exam must be in the exam's class
const assertStudentsInClass = async (user, studentIds, classId) => {
  if (user?.role !== 'TEACHER') return;
  const ids = [...new Set(studentIds)];
  const inClass = await prisma.student.count({ where: { id: { in: ids }, classId } });
  if (inClass !== ids.length) {
    throw AppError.forbidden('بعض الطلاب ليسوا مقيدين في فصل هذا الامتحان');
  }
};

export class GradesService {
  // --- Exam Schedules ---
  static async getExams(query) {
    return GradeModel.findAllExams(query);
  }

  static async getExamById(id) {
    const exam = await GradeModel.findExamById(id);
    if (!exam) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return exam;
  }

  static async createExam(data, user) {
    await assertTeaches(user, data.classId, data.subjectId);
    return GradeModel.createExam(data);
  }

  static async updateExam(id, data, user) {
    const exam = await prisma.exam.findUnique({ where: { id }, select: { classId: true, subjectId: true } });
    if (!exam) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    await assertTeaches(user, exam.classId, exam.subjectId);
    // Moving the exam to another class / subject needs that one to be the teacher's too
    const classId = data.classId || exam.classId;
    const subjectId = data.subjectId || exam.subjectId;
    if (classId !== exam.classId || subjectId !== exam.subjectId) {
      await assertTeaches(user, classId, subjectId);
    }
    const updated = await GradeModel.updateExam(id, data);
    if (!updated) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteExam(id) {
    const deleted = await GradeModel.deleteExam(id);
    if (!deleted) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return true;
  }

  // --- Manual Marks Recording ---
  static async getGrades(query, user) {
    return GradeModel.findAllGrades(query, await visibleGradesWhere(user));
  }

  static async getGradeById(id, user) {
    const visible = await prisma.grade.findFirst({ where: { id, ...(await visibleGradesWhere(user)) }, select: { id: true } });
    const grade = visible && (await GradeModel.findGradeById(id));
    if (!grade) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return grade;
  }

  static async submitGrade(data, user) {
    const exam = await prisma.exam.findUnique({ where: { id: data.examId }, select: { classId: true, subjectId: true } });
    if (!exam) {
      throw AppError.notFound(`Exam with id '${data.examId}' not found`);
    }
    await assertTeaches(user, exam.classId, exam.subjectId);
    await assertStudentsInClass(user, [data.studentId], exam.classId);
    // A grade is always in its exam's subject
    return GradeModel.createGrade({ ...data, subjectId: exam.subjectId });
  }

  static async recordBulkMarks({ examId, marks, recordedBy }, user) {
    if (!examId) {
      throw AppError.badRequest('examId is required for recording marks');
    }

    if (!Array.isArray(marks) || marks.length === 0) {
      throw AppError.badRequest('marks must be a non-empty array of student marks');
    }

    const exam = await GradeModel.findExamById(examId);
    if (!exam) {
      throw AppError.notFound(`Exam with id '${examId}' not found`);
    }
    await assertTeaches(user, exam.classId, exam.subjectId);
    await assertStudentsInClass(user, marks.map((item) => item.studentId), exam.classId);

    const resolvedMaxScore = exam.maxScore;

    // A grade is always in its exam's subject
    const preparedMarks = marks.map((item) => ({
      studentId: item.studentId,
      examId,
      subjectId: exam.subjectId,
      score: item.score,
      maxScore: item.maxScore || resolvedMaxScore,
      remarks: item.remarks || '',
    }));

    const result = await GradeModel.recordBulkMarks(preparedMarks, recordedBy);
    return {
      examId,
      recordedCount: result.length,
      marks: result,
    };
  }

  /** A student's grades the viewer may see (a teacher: only their subjects in their classes). */
  static async getStudentReportCard(studentId, user) {
    const studentGrades = await GradeModel.findAllGrades({ studentId }, await visibleGradesWhere(user));

    if (studentGrades.length === 0) {
      return {
        studentId,
        totalExamsTaken: 0,
        averagePercentage: 0,
        overallGrade: 'N/A',
        subjects: [],
      };
    }

    const totalPercentage = studentGrades.reduce((sum, g) => sum + g.percentage, 0);
    const averagePercentage = Math.round(totalPercentage / studentGrades.length);

    let overallGrade = 'F';
    if (averagePercentage >= 95) overallGrade = 'A+';
    else if (averagePercentage >= 85) overallGrade = 'A';
    else if (averagePercentage >= 75) overallGrade = 'B';
    else if (averagePercentage >= 65) overallGrade = 'C';
    else if (averagePercentage >= 50) overallGrade = 'D';

    return {
      studentId,
      totalExamsTaken: studentGrades.length,
      averagePercentage,
      overallGrade,
      grades: studentGrades,
    };
  }

  static async updateGrade(id, data, user) {
    const grade = await prisma.grade.findUnique({ where: { id }, select: { exam: { select: { classId: true, subjectId: true } } } });
    if (!grade) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    await assertTeaches(user, grade.exam.classId, grade.exam.subjectId);
    const updated = await GradeModel.updateGrade(id, data);
    if (!updated) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteGrade(id) {
    const deleted = await GradeModel.deleteGrade(id);
    if (!deleted) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return true;
  }
}

export default GradesService;
