import { prisma } from '../../config/database.js';

const calculateGradeLetter = (percentage) => {
  if (percentage >= 95) return 'A+';
  if (percentage >= 85) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 65) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

export class GradeModel {
  // --- Exam Schedules Logic ---
  static async findAllExams({ classId, subjectId, type } = {}) {
    const where = {};

    if (classId) {
      where.classId = classId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    if (type) {
      where.type = type.toUpperCase();
    }

    return prisma.exam.findMany({
      where,
      include: {
        subject: { select: { id: true, code: true, nameArabic: true } },
        class: { select: { id: true, name: true } },
        announcedBy: { select: { id: true, name: true } },
        announcedByTeacher: { select: { id: true, fullNameArabic: true } },
      },
      orderBy: { examDate: 'asc' },
    });
  }

  static async findExamById(id) {
    return prisma.exam.findUnique({
      where: { id },
      include: {
        subject: true,
        class: true,
        announcedBy: { select: { id: true, name: true } },
        announcedByTeacher: { select: { id: true, fullNameArabic: true } },
        grades: {
          include: {
            student: { select: { id: true, studentCode: true, fullNameArabic: true } },
          },
        },
      },
    });
  }

  static async createExam(data) {
    return prisma.exam.create({
      data: {
        title: data.title,
        type: data.type ? data.type.toUpperCase() : 'MIDTERM',
        subjectId: data.subjectId,
        classId: data.classId,
        examDate: new Date(data.examDate),
        durationMinutes: Number(data.durationMinutes) || 60,
        maxScore: Number(data.maxScore) || 100,
        passScore: Number(data.passScore) || 50,
        room: data.room || null,
        // An admin (users) or a teacher (teachers)
        announcedById: data.announcedById || null,
        announcedByTeacherId: data.announcedByTeacherId || null,
      },
      include: {
        subject: true,
        class: true,
      },
    });
  }

  static async updateExam(id, data) {
    const allowed = ['title', 'type', 'subjectId', 'classId', 'examDate', 'durationMinutes', 'maxScore', 'passScore', 'room'];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }
    if (updateData.type) {
      updateData.type = updateData.type.toUpperCase();
    }
    if (updateData.examDate) {
      updateData.examDate = new Date(updateData.examDate);
    }
    if (updateData.durationMinutes !== undefined) {
      updateData.durationMinutes = Number(updateData.durationMinutes);
    }
    if (updateData.maxScore !== undefined) {
      updateData.maxScore = Number(updateData.maxScore);
    }
    if (updateData.passScore !== undefined) {
      updateData.passScore = Number(updateData.passScore);
    }

    return prisma.exam.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteExam(id) {
    await prisma.exam.delete({
      where: { id },
    });
    return true;
  }

  // --- Marks Recording Logic ---
  /** `visible`: what the viewer may see (a Prisma condition), on top of the filters. */
  static async findAllGrades({ studentId, examId, subjectId } = {}, visible = {}) {
    // Its own AND item, so a filter (e.g. ?studentId=) can't replace it
    const where = { AND: [visible] };

    if (studentId) {
      where.studentId = studentId;
    }

    if (examId) {
      where.examId = examId;
    }

    if (subjectId) {
      where.subjectId = subjectId;
    }

    return prisma.grade.findMany({
      where,
      include: {
        student: { select: { id: true, studentCode: true, fullNameArabic: true } },
        exam: { select: { id: true, title: true, type: true, examDate: true } },
        subject: { select: { id: true, code: true, nameArabic: true } },
        recordedBy: { select: { id: true, name: true } },
        recordedByTeacher: { select: { id: true, fullNameArabic: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findGradeById(id) {
    return prisma.grade.findUnique({
      where: { id },
      include: {
        student: true,
        exam: true,
        subject: true,
        recordedBy: { select: { id: true, name: true } },
        recordedByTeacher: { select: { id: true, fullNameArabic: true } },
      },
    });
  }

  static async createGrade(data) {
    const score = Number(data.score);
    const maxScore = Number(data.maxScore) || 100;
    const percentage = Math.round((score / maxScore) * 100);
    const gradeLetter = calculateGradeLetter(percentage);

    return prisma.grade.upsert({
      where: {
        studentId_examId: {
          studentId: data.studentId,
          examId: data.examId,
        },
      },
      update: {
        score,
        maxScore,
        percentage,
        gradeLetter,
        remarks: data.remarks || null,
        // An admin (users) or a teacher (teachers)
        recordedById: data.recordedById || null,
        recordedByTeacherId: data.recordedByTeacherId || null,
      },
      create: {
        studentId: data.studentId,
        examId: data.examId,
        subjectId: data.subjectId,
        score,
        maxScore,
        percentage,
        gradeLetter,
        remarks: data.remarks || null,
        recordedById: data.recordedById || null,
        recordedByTeacherId: data.recordedByTeacherId || null,
      },
      include: {
        student: true,
        exam: true,
        subject: true,
      },
    });
  }

  /** `recordedBy`: { recordedById, recordedByTeacherId } (an admin or a teacher). */
  static async recordBulkMarks(marksList, recordedBy = {}) {
    const recorder = {
      recordedById: recordedBy.recordedById || null,
      recordedByTeacherId: recordedBy.recordedByTeacherId || null,
    };
    const operations = marksList.map((item) => {
      const score = Number(item.score);
      const maxScore = Number(item.maxScore) || 100;
      const percentage = Math.round((score / maxScore) * 100);
      const gradeLetter = calculateGradeLetter(percentage);

      return prisma.grade.upsert({
        where: {
          studentId_examId: {
            studentId: item.studentId,
            examId: item.examId,
          },
        },
        update: {
          score,
          maxScore,
          percentage,
          gradeLetter,
          remarks: item.remarks || null,
          ...recorder,
        },
        create: {
          studentId: item.studentId,
          examId: item.examId,
          subjectId: item.subjectId,
          score,
          maxScore,
          percentage,
          gradeLetter,
          remarks: item.remarks || null,
          ...recorder,
        },
        include: {
          student: true,
          exam: true,
          subject: true,
        },
      });
    });

    return prisma.$transaction(operations);
  }

  static async updateGrade(id, data) {
    const current = await prisma.grade.findUnique({ where: { id } });
    if (!current) return null;

    const score = data.score !== undefined ? Number(data.score) : current.score;
    const maxScore = data.maxScore !== undefined ? Number(data.maxScore) : current.maxScore;
    const percentage = Math.round((score / maxScore) * 100);
    const gradeLetter = calculateGradeLetter(percentage);

    const updateData = {
      score,
      maxScore,
      percentage,
      gradeLetter,
    };
    if (data.notes !== undefined) updateData.notes = data.notes;

    return prisma.grade.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteGrade(id) {
    await prisma.grade.delete({
      where: { id },
    });
    return true;
  }
}

export default GradeModel;
