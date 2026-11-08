import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { arabicSortKey, compareArabic } from '../../shared/utils/arabic.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';
import { MAX_HOLIDAY_DAYS } from './teacher-attendance.validation.js';

const SCHOOL_TIME_ZONE = 'Africa/Cairo';
// Friday & Saturday (Date#getUTCDay)
const WEEKEND_DAYS = [5, 6];
const ON_DUTY = ['PRESENT', 'LATE'];
// Upper bound for one Excel / PDF export (about a full school year of a large staff)
const MAX_EXPORT_ROWS = 20000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const RECORD_SELECT = {
  teacherId: true,
  teacherName: true,
  specialization: true,
  status: true,
  arrivalTime: true,
  departureTime: true,
  note: true,
};

/** Today's date at the school (YYYY-MM-DD), whatever the server's time zone is. */
export const schoolToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const isWeekend = (date) => WEEKEND_DAYS.includes(new Date(`${date}T00:00:00Z`).getUTCDay());

const daysBetween = (from, to) =>
  Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;

const byArabicName = (a, b) => compareArabic(a.teacherName, b.teacherName);

const toRecordDto = (row) => ({
  teacherId: row.teacherId,
  teacherName: row.teacherName,
  specialization: row.specialization,
  status: row.status,
  arrivalTime: row.arrivalTime ?? '',
  departureTime: row.departureTime ?? '',
  note: row.note ?? '',
});

export class TeacherAttendanceService {
  /**
   * The attendance sheet of one day: every active teacher (A→Z) with their saved status, if any.
   * A closed day shows exactly what was approved (including teachers removed since).
   */
  static async getDay(date) {
    await this.closeFinishedDays();

    const today = schoolToday();
    const [holiday, dayRow] = await Promise.all([
      this.findHoliday(date),
      prisma.teacherAttendanceDay.findUnique({
        where: { date },
        include: { closedBy: { select: { fullName: true, name: true } } },
      }),
    ]);
    const closedDay = dayRow?.isClosed ? dayRow : null;
    const dayType = holiday ? 'HOLIDAY' : isWeekend(date) ? 'WEEKEND' : 'SCHOOL_DAY';
    const isFuture = date > today;

    const saved = await prisma.teacherAttendance.findMany({ where: { date }, select: RECORD_SELECT });
    let records;
    if (closedDay) {
      records = saved.map(toRecordDto);
    } else {
      const teachers = await prisma.teacher.findMany({
        where: { isActive: true },
        select: { id: true, fullNameArabic: true, specialization: true },
      });
      const savedByTeacher = new Map(saved.map((row) => [row.teacherId, row]));
      records = teachers.map((teacher) => {
        const row = savedByTeacher.get(teacher.id);
        return row
          ? { ...toRecordDto(row), teacherName: teacher.fullNameArabic, specialization: teacher.specialization }
          : {
              teacherId: teacher.id,
              teacherName: teacher.fullNameArabic,
              specialization: teacher.specialization,
              status: null,
              arrivalTime: '',
              departureTime: '',
              note: '',
            };
      });
    }
    records.sort(byArabicName);

    return {
      date,
      today,
      dayType,
      holiday: holiday && { id: holiday.id, reason: holiday.reason, startDate: holiday.startDate, endDate: holiday.endDate },
      isFuture,
      closed: closedDay && {
        closedAt: closedDay.closedAt,
        closedBy: closedDay.closedBy?.fullName || closedDay.closedBy?.name || null,
        autoClosed: closedDay.autoClosed,
      },
      editable: dayType === 'SCHOOL_DAY' && !isFuture && !closedDay,
      records,
    };
  }

  /** Saves (creates or updates) the statuses of the given teachers for an open day. */
  static async saveDay(date, records, userId) {
    await this.assertEditable(date);

    const ids = records.map((record) => record.teacherId);
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullNameArabic: true, specialization: true, isActive: true },
    });
    if (teachers.length !== ids.length) {
      throw AppError.badRequest('يوجد معلم غير مسجل في النظام ضمن البيانات المرسلة');
    }
    // A teacher who left the school is no longer in the book (reload the day's sheet)
    const stopped = teachers.filter((teacher) => !teacher.isActive);
    if (stopped.length) {
      throw AppError.badRequest(
        `المعلم ${stopped.map((t) => t.fullNameArabic).join('، ')} موقوف ولا يُسجَّل له حضور. حدّث الصفحة`
      );
    }
    const teachersById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

    // A past day filled in late stays open until someone approves it (no automatic close)
    const markLateEntry =
      date < schoolToday()
        ? [prisma.teacherAttendanceDay.createMany({ data: [{ date, isClosed: false, closedAt: null }], skipDuplicates: true })]
        : [];

    await prisma.$transaction([
      ...markLateEntry,
      ...records.map((record) => {
        const teacher = teachersById.get(record.teacherId);
        const onDuty = ON_DUTY.includes(record.status);
        const data = {
          teacherName: teacher.fullNameArabic,
          teacherSortKey: arabicSortKey(teacher.fullNameArabic),
          specialization: teacher.specialization,
          status: record.status,
          // Arrival & departure only make sense when the teacher came in
          arrivalTime: onDuty ? record.arrivalTime || null : null,
          departureTime: onDuty ? record.departureTime || null : null,
          note: record.note?.trim() || null,
          recordedById: userId,
        };
        return prisma.teacherAttendance.upsert({
          where: { teacherId_date: { teacherId: record.teacherId, date } },
          create: { ...data, teacherId: record.teacherId, date },
          update: data,
        });
      }),
    ]);

    return this.getDay(date);
  }

  /** Approves a day: teachers left without a status are recorded as NOT_RECORDED and the day is locked. */
  static async closeDay(date, userId) {
    await this.assertEditable(date);
    await this.lockDay(date, { closedById: userId, autoClosed: false });
    return this.getDay(date);
  }

  /** Super admin only: unlocks a closed day so it can be corrected; it stays open until approved again. */
  static async reopenDay(date) {
    const dayRow = await prisma.teacherAttendanceDay.findUnique({ where: { date } });
    if (!dayRow?.isClosed) {
      throw AppError.badRequest('هذا اليوم غير مُعتمد أصلاً');
    }
    await prisma.$transaction([
      // Placeholders are re-created if the day is closed again
      prisma.teacherAttendance.deleteMany({ where: { date, status: 'NOT_RECORDED' } }),
      prisma.teacherAttendanceDay.update({
        where: { date },
        data: { isClosed: false, closedAt: null, closedById: null, autoClosed: false },
      }),
    ]);
    return this.getDay(date);
  }

  /** Approved days (A→Z within each day, newest day first), paginated. */
  static async getArchive(query) {
    await this.closeFinishedDays();

    // `limit` is the standard name; `pageSize` is still accepted from older callers
    const { page, limit, skip, take } = parsePagination(
      { page: query.page, limit: query.limit ?? query.pageSize },
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const where = await this.archiveWhere(query);

    const [total, rows, groups] = await Promise.all([
      prisma.teacherAttendance.count({ where }),
      prisma.teacherAttendance.findMany({
        where,
        select: { id: true, date: true, ...RECORD_SELECT },
        orderBy: [{ date: 'desc' }, { teacherSortKey: 'asc' }],
        skip,
        take,
      }),
      prisma.teacherAttendance.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, date: row.date, ...toRecordDto(row) })),
      summary: Object.fromEntries(groups.map((group) => [group.status, group._count._all])),
      // pageSize mirrors limit for callers that read the old name
      meta: { ...buildPaginationMeta({ total, page, limit }), pageSize: limit },
    };
  }

  /** Every archived row matching the filters (oldest first), for the Excel / PDF export. */
  static async exportArchive(query) {
    await this.closeFinishedDays();

    const where = await this.archiveWhere(query);
    const total = await prisma.teacherAttendance.count({ where });
    if (total > MAX_EXPORT_ROWS) {
      throw AppError.badRequest('عدد السجلات كبير جداً للتصدير مرة واحدة، اختر فترة أقصر');
    }
    const rows = await prisma.teacherAttendance.findMany({
      where,
      select: { date: true, ...RECORD_SELECT },
      orderBy: [{ date: 'asc' }, { teacherSortKey: 'asc' }],
    });
    return rows.map((row) => ({ date: row.date, ...toRecordDto(row) }));
  }

  static async getHolidays() {
    return prisma.schoolHoliday.findMany({
      select: { id: true, startDate: true, endDate: true, reason: true, createdAt: true },
      orderBy: { startDate: 'desc' },
    });
  }

  static async createHoliday({ startDate, endDate, reason }, userId) {
    const end = endDate || startDate;
    if (daysBetween(startDate, end) > MAX_HOLIDAY_DAYS) {
      throw AppError.badRequest(`مدة الإجازة لا يمكن أن تزيد عن ${MAX_HOLIDAY_DAYS} يوماً`);
    }

    const overlapping = await prisma.schoolHoliday.findFirst({
      where: { startDate: { lte: end }, endDate: { gte: startDate } },
    });
    if (overlapping) {
      throw AppError.conflict(`الفترة دي متداخلة مع إجازة مسجلة بالفعل: ${overlapping.reason}`);
    }

    // A day that already has attendance can't silently become a day off
    const recorded = await prisma.teacherAttendance.findFirst({
      where: { date: { gte: startDate, lte: end }, status: { not: 'NOT_RECORDED' } },
      select: { date: true },
      orderBy: { date: 'asc' },
    });
    if (recorded) {
      throw AppError.conflict(`يوم ${recorded.date} اتسجل فيه حضور المعلمين بالفعل، لا يمكن تسجيله إجازة`);
    }

    return prisma.schoolHoliday.create({
      data: { startDate, endDate: end, reason: reason.trim(), createdById: userId },
      select: { id: true, startDate: true, endDate: true, reason: true, createdAt: true },
    });
  }

  static async deleteHoliday(id) {
    const holiday = await prisma.schoolHoliday.findUnique({ where: { id } });
    if (!holiday) {
      throw AppError.notFound('الإجازة غير موجودة');
    }
    await prisma.schoolHoliday.delete({ where: { id } });
  }

  // ---- helpers ----

  static findHoliday(date) {
    return prisma.schoolHoliday.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
  }

  static async assertEditable(date) {
    if (date > schoolToday()) {
      throw AppError.badRequest('لا يمكن تسجيل الحضور ليوم لم يأتِ بعد');
    }
    if (isWeekend(date)) {
      throw AppError.badRequest('هذا اليوم إجازة أسبوعية (الجمعة أو السبت)');
    }
    const holiday = await this.findHoliday(date);
    if (holiday) {
      throw AppError.badRequest(`هذا اليوم إجازة رسمية: ${holiday.reason}`);
    }
    const dayRow = await prisma.teacherAttendanceDay.findUnique({ where: { date } });
    if (dayRow?.isClosed) {
      throw AppError.conflict('تم اعتماد دفتر هذا اليوم ولا يمكن تعديله');
    }
  }

  static async lockDay(date, { closedById = null, autoClosed }) {
    const [teachers, saved] = await Promise.all([
      prisma.teacher.findMany({ where: { isActive: true }, select: { id: true, fullNameArabic: true, specialization: true } }),
      prisma.teacherAttendance.findMany({ where: { date }, select: { teacherId: true } }),
    ]);
    const recorded = new Set(saved.map((row) => row.teacherId));
    const missing = teachers
      .filter((teacher) => !recorded.has(teacher.id))
      .map((teacher) => ({
        date,
        teacherId: teacher.id,
        teacherName: teacher.fullNameArabic,
        teacherSortKey: arabicSortKey(teacher.fullNameArabic),
        specialization: teacher.specialization,
        status: 'NOT_RECORDED',
      }));

    const closed = { isClosed: true, closedAt: new Date(), closedById, autoClosed };
    await prisma.$transaction([
      // skipDuplicates: two requests may close the same day at once
      prisma.teacherAttendance.createMany({ data: missing, skipDuplicates: true }),
      // Automatic closing only ever creates the row; a manual one also closes a day opened by hand
      autoClosed
        ? prisma.teacherAttendanceDay.createMany({ data: [{ date, ...closed }], skipDuplicates: true })
        : prisma.teacherAttendanceDay.upsert({ where: { date }, create: { date, ...closed }, update: closed }),
    ]);
  }

  /**
   * Closes past days that have attendance but were never approved. Runs lazily on reads,
   * so no scheduler is needed and a sleeping server catches up on its next request.
   * Days opened by hand (they have a row with isClosed = false) are left for a manual approval.
   */
  static async closeFinishedDays() {
    const pending = await prisma.$queryRaw`
      SELECT DISTINCT a."date" FROM "teacher_attendances" a
      LEFT JOIN "teacher_attendance_days" d ON d."date" = a."date"
      WHERE d."date" IS NULL AND a."date" < ${schoolToday()}`;
    for (const { date } of pending) {
      await this.lockDay(date, { autoClosed: true });
    }
  }

  /** Archive = approved days only: today once approved, and every past day except those opened by hand. */
  static async archiveWhere({ from, to, teacherId, status }) {
    const today = schoolToday();
    const [todayRow, openDays] = await Promise.all([
      prisma.teacherAttendanceDay.findUnique({ where: { date: today } }),
      prisma.teacherAttendanceDay.findMany({ where: { isClosed: false }, select: { date: true } }),
    ]);

    const date = {};
    if (from) date.gte = from;
    if (to && to < today) date.lte = to;
    else if (todayRow?.isClosed) date.lte = today;
    else date.lt = today;
    if (openDays.length) date.notIn = openDays.map((day) => day.date);

    return {
      date,
      ...(teacherId && { teacherId }),
      ...(status && { status }),
    };
  }
}

export default TeacherAttendanceService;
