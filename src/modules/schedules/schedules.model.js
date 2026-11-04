import { prisma } from '../../config/database.js';

export class SchedulesModel {
  /**
   * Find all timetable periods for a specific teacher and term
   */
  static async findByTeacher(teacherId, termId) {
    return prisma.timetablePeriod.findMany({
      where: {
        teacherId,
        termId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
          },
        },
        teacher: {
          select: {
            id: true,
            fullNameArabic: true,
            jobTitle: true,
            teachingSubjects: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { period: 'asc' },
      ],
    });
  }

  /**
   * Find all timetable periods for a specific class and term
   */
  static async findByClass(classId, termId) {
    return prisma.timetablePeriod.findMany({
      where: {
        classId,
        termId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullNameArabic: true,
            jobTitle: true,
            teachingSubjects: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { period: 'asc' },
      ],
    });
  }

  /**
   * Find all timetable periods for the entire school for a term
   */
  static async findBySchool(termId) {
    return prisma.timetablePeriod.findMany({
      where: {
        termId,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullNameArabic: true,
            jobTitle: true,
            teachingSubjects: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            gradeLevel: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { period: 'asc' },
      ],
    });
  }

  /**
   * Check if any requested slots conflict with other teachers for the same class and term
   */
  static async findConflictingSlots(termId, teacherId, slots) {
    if (!slots || slots.length === 0) return [];

    const conditions = slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      period: s.period,
      classId: s.classId,
    }));

    return prisma.timetablePeriod.findMany({
      where: {
        termId,
        teacherId: { not: teacherId },
        OR: conditions,
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullNameArabic: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Replace a teacher's schedule atomically inside a transaction
   */
  static async replaceTeacherSchedule(teacherId, termId, newSlots) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete old periods for this teacher in this term
      await tx.timetablePeriod.deleteMany({
        where: {
          teacherId,
          termId,
        },
      });

      // 2. Insert new periods if provided
      if (newSlots.length > 0) {
        await tx.timetablePeriod.createMany({
          data: newSlots.map((slot) => ({
            termId,
            teacherId,
            classId: slot.classId,
            dayOfWeek: slot.dayOfWeek,
            period: slot.period,
            subject: slot.subject,
            room: slot.room || null,
          })),
        });
      }

      // 3. Return refreshed periods
      return tx.timetablePeriod.findMany({
        where: {
          teacherId,
          termId,
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              gradeLevel: true,
            },
          },
          teacher: {
            select: {
              id: true,
              fullNameArabic: true,
              jobTitle: true,
              teachingSubjects: true,
            },
          },
        },
        orderBy: [
          { dayOfWeek: 'asc' },
          { period: 'asc' },
        ],
      });
    });
  }
}

export default SchedulesModel;

