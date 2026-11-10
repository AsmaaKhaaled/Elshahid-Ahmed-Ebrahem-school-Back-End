import { prisma } from '../../config/database.js';
import { SchedulesModel } from './schedules.model.js';
import {
  DEFAULT_TERM_ID,
  DAY_NAMES,
  PERIOD_TIMINGS,
  PERIOD_ORDINALS,
  parseSlotKey,
  formatSlotKey,
  weeklyPeriodLimit,
} from './schedules.constants.js';
import { AppError } from '../../shared/errors/app-error.js';
import { assignmentsOf } from '../teachers/teachers.service.js';

export class SchedulesService {
  /**
   * Helper to normalize slots input from payload (handles slotKey, className vs classId)
   */
  static async resolveSlotsInput(rawSlots) {
    if (!Array.isArray(rawSlots)) return [];

    // Preload all classes for fast lookup by id or name
    // Only this year's (active) classes can be scheduled
    const allClasses = await prisma.class.findMany({
      where: { isActive: true },
      select: { id: true, name: true, gradeLevel: true },
    });
    const classById = new Map(allClasses.map((c) => [c.id, c]));
    const classByName = new Map(allClasses.map((c) => [c.name.trim(), c]));

    const normalized = [];

    for (const item of rawSlots) {
      let day = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : undefined;
      let period = item.period !== undefined ? Number(item.period) : undefined;

      if ((day === undefined || period === undefined) && item.slotKey) {
        const parsed = parseSlotKey(item.slotKey);
        if (parsed) {
          day = parsed.dayOfWeek;
          period = parsed.period;
        }
      }

      // Never drop a period silently (the request validation already rejects these)
      if (!Number.isInteger(day) || day < 0 || day > 4 || !Number.isInteger(period) || period < 1 || period > 7) {
        throw AppError.badRequest('يوجد حصة بيوم أو رقم حصة غير صحيح في الجدول');
      }

      // Resolve class
      let matchedClass = null;
      if (item.classId && classById.has(item.classId)) {
        matchedClass = classById.get(item.classId);
      } else if (item.className && classByName.has(item.className.trim())) {
        matchedClass = classByName.get(item.className.trim());
      } else if (item.section && classByName.has(item.section.trim())) {
        matchedClass = classByName.get(item.section.trim());
      }

      if (!matchedClass) {
        throw AppError.badRequest(
          `الفصل الدراسي '${item.className || item.classId || item.section}' غير موجود أو غير مفعّل هذا العام`
        );
      }

      const subject = (item.subject || '').trim();
      if (!subject) {
        throw AppError.badRequest('المادة الدراسية مطلوبة لكل حصة');
      }

      normalized.push({
        dayOfWeek: day,
        period,
        classId: matchedClass.id,
        className: matchedClass.name,
        subject,
        room: item.room ? String(item.room).trim() : null,
      });
    }

    return normalized;
  }

  /**
   * Save or update a teacher's weekly schedule with strict conflict detection
   */
  static async saveTeacherSchedule(teacherId, payload) {
    const termId = (payload.termId || DEFAULT_TERM_ID).trim();

    // 1. Check teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        fullNameArabic: true,
        teacherCode: true,
        isActive: true,
        teachingSubjects: true,
        teachingAssignments: true,
        classes: { select: { name: true } },
      },
    });

    if (!teacher) {
      throw AppError.notFound(`المعلم ذو المعرف '${teacherId}' غير موجود`);
    }

    // 2. Resolve & normalize slots
    const requestedSlots = await this.resolveSlotsInput(payload.slots);

    // A teacher who left the school gets no periods
    if (!teacher.isActive && requestedSlots.length) {
      throw AppError.badRequest('المعلم موقوف (ترك المدرسة)، لا يمكن إسناد حصص له');
    }

    // 2b. Each period must be a subject the teacher teaches to that class (as assigned on the teachers page)
    const taught = new Set(
      assignmentsOf(teacher, teacher.classes.map((c) => c.name)).flatMap((a) =>
        a.classes.map((cls) => `${a.subject.trim()}|${cls}`)
      )
    );
    const notTaught = [
      ...new Set(
        requestedSlots
          .filter((slot) => !taught.has(`${slot.subject}|${slot.className}`))
          .map((slot) => `${slot.subject} لفصل ${slot.className}`)
      ),
    ];
    if (notTaught.length) {
      throw AppError.badRequest(
        `لم يُسند إلى المعلم: ${notTaught.join('، ')}. أضف المادة والفصل للمعلم من صفحة المعلمين أولًا`
      );
    }

    // 3. Level 1 Conflict: Teacher cannot teach 2 classes at the same day & period
    const teacherSlotOccupied = new Map();
    for (const slot of requestedSlots) {
      const key = `${slot.dayOfWeek}-${slot.period}`;
      if (teacherSlotOccupied.has(key)) {
        const existing = teacherSlotOccupied.get(key);
        const dayName = DAY_NAMES[slot.dayOfWeek] || `يوم ${slot.dayOfWeek}`;
        const periodOrdinal = PERIOD_ORDINALS[slot.period] || `رقم ${slot.period}`;

        const err = new AppError(
          `تعارض في الجدول الدراسي: لا يمكن إسناد فصلين مختلفين (${existing.className} و ${slot.className}) لنفس المعلم في الحصة ${periodOrdinal} يوم ${dayName}`,
          409
        );
        err.code = 'TIMETABLE_CONFLICT';
        err.conflict = {
          dayOfWeek: slot.dayOfWeek,
          dayName,
          period: slot.period,
          className: slot.className,
          conflictingTeacherName: teacher.fullNameArabic,
          subject: slot.subject,
        };
        throw err;
      }
      teacherSlotOccupied.set(key, slot);
    }

    // 4. Level 2 Conflict: Class cannot have 2 different teachers in the same day & period
    const conflictingPeriods = await SchedulesModel.findConflictingSlots(
      termId,
      teacherId,
      requestedSlots
    );

    if (conflictingPeriods.length > 0) {
      const conflict = conflictingPeriods[0];
      const dayName = DAY_NAMES[conflict.dayOfWeek] || `يوم ${conflict.dayOfWeek}`;
      const periodOrdinal = PERIOD_ORDINALS[conflict.period] || `رقم ${conflict.period}`;
      const conflictingTeacherName = conflict.teacher?.fullNameArabic || 'معلم آخر';
      const className = conflict.class?.name || 'الفصل';

      const err = new AppError(
        `تعارض في الجدول الدراسي: تم حجز فصل (${className}) مسبقاً في الحصة ${periodOrdinal} يوم ${dayName} للأستاذ/ ${conflictingTeacherName}`,
        409
      );
      err.code = 'TIMETABLE_CONFLICT';
      err.conflict = {
        dayOfWeek: conflict.dayOfWeek,
        dayName,
        period: conflict.period,
        className,
        conflictingTeacherName: `أ. ${conflictingTeacherName}`,
        subject: conflict.subject,
      };
      throw err;
    }

    // 5. A class can't get more weekly periods of a subject than the school's limit, whoever teaches them
    await this.assertWeeklyLimits(termId, teacherId, requestedSlots);

    // 6. Atomic save in database transaction
    const savedPeriods = await SchedulesModel.replaceTeacherSchedule(
      teacherId,
      termId,
      requestedSlots
    );

    const distinctClasses = new Set(savedPeriods.map((p) => p.classId));

    return {
      teacherId: teacher.id,
      teacherName: teacher.fullNameArabic,
      totalWeeklyPeriods: savedPeriods.length,
      classesCount: distinctClasses.size,
    };
  }

  /**
   * Refuses a schedule that takes a class past its weekly periods of a subject,
   * counting the periods other teachers already give that class.
   */
  static async assertWeeklyLimits(termId, teacherId, requestedSlots) {
    const othersPeriods = await SchedulesModel.findOtherTeachersPeriods(termId, teacherId, [
      ...new Set(requestedSlots.map((slot) => slot.classId)),
    ]);

    const othersCount = new Map();
    for (const { classId, subject } of othersPeriods) {
      const key = `${classId}|${subject}`;
      othersCount.set(key, (othersCount.get(key) ?? 0) + 1);
    }

    const requested = new Map();
    for (const slot of requestedSlots) {
      const key = `${slot.classId}|${slot.subject}`;
      const entry = requested.get(key) ?? { ...slot, count: othersCount.get(key) ?? 0 };
      entry.count += 1;
      requested.set(key, entry);
    }

    const exceeded = [...requested.values()].flatMap(({ className, subject, count }) => {
      const limit = weeklyPeriodLimit(className, subject);
      return limit !== undefined && count > limit ? [`${subject} لفصل ${className}: ${count} حصة والمسموح ${limit}`] : [];
    });

    if (exceeded.length) {
      const err = AppError.conflict(`تم تجاوز عدد الحصص الأسبوعية المقرر: ${exceeded.join('، ')}`);
      err.code = 'WEEKLY_PERIODS_EXCEEDED';
      throw err;
    }
  }

  /**
   * Get a specific teacher's weekly schedule
   */
  static async getTeacherSchedule(teacherId, termId = DEFAULT_TERM_ID) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        fullNameArabic: true,
        jobTitle: true,
        teachingSubjects: true,
      },
    });

    if (!teacher) {
      throw AppError.notFound(`المعلم ذو المعرف '${teacherId}' غير موجود`);
    }

    const periods = await SchedulesModel.findByTeacher(teacherId, termId);

    const scheduleMap = {};
    for (const p of periods) {
      const key = formatSlotKey(p.dayOfWeek, p.period);
      scheduleMap[key] = {
        period: p.period,
        day: p.dayOfWeek,
        dayName: DAY_NAMES[p.dayOfWeek] || '',
        time: PERIOD_TIMINGS[p.period] || '',
        className: p.class.name,
        classId: p.classId,
        subject: p.subject,
        room: p.room || null,
      };
    }

    const specialization =
      teacher.teachingSubjects && teacher.teachingSubjects.length > 0
        ? teacher.teachingSubjects[0]
        : teacher.jobTitle || 'غير محدد';

    return {
      teacherId: teacher.id,
      teacherName: teacher.fullNameArabic,
      specialization,
      termId,
      weeklyLoad: periods.length,
      schedule: scheduleMap,
    };
  }

  /**
   * Get cumulative school schedule for Admin Timetable Tab
   */
  static async getSchoolSchedule(termId = DEFAULT_TERM_ID) {
    const periods = await SchedulesModel.findBySchool(termId);

    const byClass = {};
    const byTeacher = {};

    for (const p of periods) {
      const className = p.class.name;
      const key = formatSlotKey(p.dayOfWeek, p.period);

      // byClass mapping
      if (!byClass[className]) {
        byClass[className] = {};
      }
      byClass[className][key] = {
        subject: p.subject,
        teacherId: p.teacherId,
        teacherName: `أ. ${p.teacher.fullNameArabic}`,
        room: p.room || null,
        time: PERIOD_TIMINGS[p.period] || '',
      };

      // byTeacher mapping
      if (!byTeacher[p.teacherId]) {
        byTeacher[p.teacherId] = {};
      }
      byTeacher[p.teacherId][key] = {
        subject: p.subject,
        classId: p.classId,
        className: p.class.name,
        room: p.room || null,
        time: PERIOD_TIMINGS[p.period] || '',
      };
    }

    return {
      termId,
      totalPeriodsCount: periods.length,
      byClass,
      byTeacher,
      conflicts: [],
    };
  }

  /**
   * Get teacher's own schedule (Teacher Portal)
   */
  static async getMySchedule(user, termId = DEFAULT_TERM_ID) {
    const teacherId = user.teacherProfile?.id;
    if (!teacherId) {
      throw AppError.forbidden('هذا الحساب غير مسجل كملف معلم في المنظومة');
    }

    const scheduleData = await this.getTeacherSchedule(teacherId, termId);

    // Today's periods, by the school's clock (Egypt), whatever the server's time zone is.
    // 0 = Sunday ... 4 = Thursday; Friday & Saturday have none.
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', weekday: 'short' }).format(new Date());
    const schoolDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].indexOf(weekday);
    const slots = Object.values(scheduleData.schedule);
    const todayPeriodsCount = schoolDay === -1 ? 0 : slots.filter((s) => s.day === schoolDay).length;

    return {
      ...scheduleData,
      todayPeriodsCount,
      classesCount: new Set(slots.map((s) => s.classId)).size,
    };
  }

  /**
   * Get weekly schedule for a specific class (by classId)
   */
  static async getClassSchedule(classId, termId = DEFAULT_TERM_ID) {
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, gradeLevel: true },
    });

    if (!classRecord) {
      throw AppError.notFound(`الفصل ذو المعرف '${classId}' غير موجود`);
    }

    const periods = await SchedulesModel.findByClass(classId, termId);

    const scheduleList = periods.map((p) => ({
      dayOfWeek: p.dayOfWeek,
      dayName: DAY_NAMES[p.dayOfWeek] || '',
      period: p.period,
      time: PERIOD_TIMINGS[p.period] || '',
      subject: p.subject,
      teacherName: `أ. ${p.teacher.fullNameArabic}`,
      room: p.room || null,
    }));

    return {
      className: classRecord.name,
      gradeLevel: classRecord.gradeLevel,
      termId,
      schedule: scheduleList,
    };
  }

  /**
   * Get student's class schedule (Student Portal)
   */
  static async getMyClassSchedule(user, termId = DEFAULT_TERM_ID) {
    const classId = user.studentProfile?.classId;
    if (!classId) {
      throw AppError.notFound('الطالب غير مقيد في أي فصل دراسي حالياً');
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, gradeLevel: true },
    });

    if (!classRecord) {
      throw AppError.notFound('بيانات الفصل الدراسي المقيد به الطالب غير موجودة');
    }

    const periods = await SchedulesModel.findByClass(classId, termId);

    const scheduleList = periods.map((p) => ({
      dayOfWeek: p.dayOfWeek,
      dayName: DAY_NAMES[p.dayOfWeek] || '',
      period: p.period,
      time: PERIOD_TIMINGS[p.period] || '',
      subject: p.subject,
      teacherName: `أ. ${p.teacher.fullNameArabic}`,
      room: p.room || null,
    }));

    return {
      className: classRecord.name,
      gradeLevel: classRecord.gradeLevel,
      termId,
      schedule: scheduleList,
    };
  }
}

export default SchedulesService;
