import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';

const DEFAULT_TERMS = [
  {
    id: '2025-2026-T2',
    year: '2025/2026',
    term: 2,
    label: 'الفصل الدراسي الثاني 2025/2026',
    isCurrent: false,
    startedAt: new Date('2026-02-07'),
    endedAt: new Date('2026-09-19'),
    plannedStartDate: new Date('2026-02-07'),
    plannedEndDate: new Date('2026-06-11'),
  },
  {
    id: '2026-2027-T1',
    year: '2026/2027',
    term: 1,
    label: 'الفصل الدراسي الأول 2026/2027',
    isCurrent: true,
    startedAt: new Date('2026-09-19'),
    endedAt: null,
    plannedStartDate: new Date('2026-09-19'),
    plannedEndDate: new Date('2027-01-21'),
  },
  {
    id: '2026-2027-T2',
    year: '2026/2027',
    term: 2,
    label: 'الفصل الدراسي الثاني 2026/2027',
    isCurrent: false,
    startedAt: null,
    endedAt: null,
    plannedStartDate: new Date('2027-02-06'),
    plannedEndDate: new Date('2027-06-10'),
  },
];

const formatDate = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return null;
};

const toDto = (t) => ({
  id: t.id,
  year: t.year,
  term: t.term,
  label: t.label,
  isCurrent: t.isCurrent,
  startedAt: formatDate(t.startedAt),
  endedAt: formatDate(t.endedAt),
  plannedStartDate: formatDate(t.plannedStartDate),
  plannedEndDate: formatDate(t.plannedEndDate),
});

export class AcademicYearService {
  /**
   * Seed default terms if table is empty
   */
  static async ensureSeeded() {
    const count = await prisma.academicTerm.count();
    if (count === 0) {
      for (const t of DEFAULT_TERMS) {
        await prisma.academicTerm.upsert({
          where: { id: t.id },
          update: {},
          create: t,
        });
      }
    }
  }

  /**
   * ① Get Current Term
   */
  static async getCurrentTerm() {
    await this.ensureSeeded();

    let current = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
    });

    if (!current) {
      current = await prisma.academicTerm.findFirst({
        orderBy: [{ year: 'desc' }, { term: 'desc' }],
      });
    }

    if (!current) {
      throw AppError.notFound('لم يتم العثور على أي فصل دراسي نشط');
    }

    return toDto(current);
  }

  /**
   * ② Get All Terms
   */
  static async getAllTerms() {
    await this.ensureSeeded();

    const terms = await prisma.academicTerm.findMany({
      orderBy: [{ year: 'asc' }, { term: 'asc' }],
    });

    const currentTerm = terms.find((t) => t.isCurrent) || null;

    return {
      currentTermId: currentTerm?.id || null,
      terms: terms.map(toDto),
    };
  }

  /**
   * ③ Transition to Next Term (Atomic)
   * Ends current term, starts next term
   */
  static async transitionToNextTerm() {
    await this.ensureSeeded();

    const current = await prisma.academicTerm.findFirst({
      where: { isCurrent: true },
    });

    if (!current) {
      throw AppError.badRequest('لا يوجد فصل دراسي حالي نشط للانتقال منه');
    }

    // Determine next term details
    let nextYear, nextTermNum, nextId, nextLabel;

    if (current.term === 1) {
      nextYear = current.year;
      nextTermNum = 2;
      nextId = `${current.year.replace('/', '-')}-T2`;
      nextLabel = `الفصل الدراسي الثاني ${current.year}`;
    } else {
      const parts = current.year.split('/').map(Number);
      const start = parts[0] || 2026;
      const end = parts[1] || 2027;
      const nextStart = end;
      const nextEnd = end + 1;
      nextYear = `${nextStart}/${nextEnd}`;
      nextTermNum = 1;
      nextId = `${nextStart}-${nextEnd}-T1`;
      nextLabel = `الفصل الدراسي الأول ${nextYear}`;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr);

    // Atomic transaction
    const nextTermRecord = await prisma.$transaction(async (tx) => {
      // 1. End current term
      await tx.academicTerm.update({
        where: { id: current.id },
        data: {
          endedAt: today,
          isCurrent: false,
        },
      });

      // 2. Start next term (update if exists, create if not)
      const existingNext = await tx.academicTerm.findUnique({
        where: { id: nextId },
      });

      if (existingNext) {
        return tx.academicTerm.update({
          where: { id: nextId },
          data: {
            startedAt: today,
            isCurrent: true,
          },
        });
      }

      return tx.academicTerm.create({
        data: {
          id: nextId,
          year: nextYear,
          term: nextTermNum,
          label: nextLabel,
          isCurrent: true,
          startedAt: today,
        },
      });
    });

    const all = await this.getAllTerms();
    return {
      currentTerm: toDto(nextTermRecord),
      ...all,
    };
  }

  /**
   * ④ Add Next Term to Timeline
   */
  static async addNextTerm({ plannedStartDate, plannedEndDate } = {}) {
    await this.ensureSeeded();

    const terms = await prisma.academicTerm.findMany({
      orderBy: [{ year: 'asc' }, { term: 'asc' }],
    });

    const latest = terms[terms.length - 1];
    let nextYear, nextTermNum, nextId, nextLabel;

    if (!latest || latest.term === 2) {
      const parts = (latest?.year || '2026/2027').split('/').map(Number);
      const nextStart = parts[1] || 2027;
      const nextEnd = nextStart + 1;
      nextYear = `${nextStart}/${nextEnd}`;
      nextTermNum = 1;
      nextId = `${nextStart}-${nextEnd}-T1`;
      nextLabel = `الفصل الدراسي الأول ${nextYear}`;
    } else {
      nextYear = latest.year;
      nextTermNum = 2;
      nextId = `${latest.year.replace('/', '-')}-T2`;
      nextLabel = `الفصل الدراسي الثاني ${nextYear}`;
    }

    const existing = await prisma.academicTerm.findUnique({
      where: { id: nextId },
    });

    if (existing) {
      throw AppError.conflict('هذا الفصل الدراسي مسجل بالفعل في التقويم');
    }

    if (plannedStartDate && plannedEndDate) {
      if (new Date(plannedStartDate) > new Date(plannedEndDate)) {
        throw AppError.badRequest('تاريخ البداية المتوقع يجب أن يكون قبل أو يساوي تاريخ النهاية المتوقع');
      }
    }

    const created = await prisma.academicTerm.create({
      data: {
        id: nextId,
        year: nextYear,
        term: nextTermNum,
        label: nextLabel,
        isCurrent: false,
        plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
      },
    });

    return {
      term: toDto(created),
      ...(await this.getAllTerms()),
    };
  }

  /**
   * ⑤ Update Planned Dates
   */
  static async updatePlannedDates(id, { plannedStartDate, plannedEndDate }) {
    await this.ensureSeeded();

    const term = await prisma.academicTerm.findUnique({
      where: { id },
    });

    if (!term) {
      throw AppError.notFound('الفصل الدراسي غير موجود');
    }

    // Planned start date cannot be changed for a term that has already started or ended
    if (term.isCurrent || term.startedAt || term.endedAt) {
      if (plannedStartDate !== undefined) {
        const existingStart = formatDate(term.plannedStartDate);
        if (plannedStartDate !== existingStart) {
          throw AppError.badRequest('لا يمكن تعديل تاريخ بداية فصل دراسي بدأ أو انتهى بالفعل');
        }
      }
    }

    const newStart = plannedStartDate !== undefined ? (plannedStartDate ? new Date(plannedStartDate) : null) : term.plannedStartDate;
    const newEnd = plannedEndDate !== undefined ? (plannedEndDate ? new Date(plannedEndDate) : null) : term.plannedEndDate;

    if (newStart && newEnd && newStart > newEnd) {
      throw AppError.badRequest('تاريخ البداية المتوقع يجب أن يكون قبل أو يساوي تاريخ النهاية المتوقع');
    }

    const updated = await prisma.academicTerm.update({
      where: { id },
      data: {
        plannedStartDate: newStart,
        plannedEndDate: newEnd,
      },
    });

    return toDto(updated);
  }

  /**
   * ⑥ Delete Upcoming Term
   * Allowed ONLY for the latest upcoming term (not current, not past)
   */
  static async deleteUpcomingTerm(id) {
    await this.ensureSeeded();

    const term = await prisma.academicTerm.findUnique({
      where: { id },
    });

    if (!term) {
      throw AppError.notFound('الفصل الدراسي غير موجود');
    }

    if (term.isCurrent || term.startedAt || term.endedAt) {
      throw AppError.badRequest('يُمنع منعاً باتاً حذف الفصل الدراسي الحالي أو أي فصول منتهية');
    }

    // Verify it is the latest term overall
    const allTerms = await prisma.academicTerm.findMany({
      orderBy: [{ year: 'asc' }, { term: 'asc' }],
    });

    const latest = allTerms[allTerms.length - 1];
    if (latest.id !== id) {
      throw AppError.badRequest('يُسمح فقط بحذف آخر فصل دراسي قادم مسجل لمنع حدوث فجوات زمنية في التقويم');
    }

    await prisma.academicTerm.delete({
      where: { id },
    });

    return {
      deletedId: id,
      ...(await this.getAllTerms()),
    };
  }
}

export default AcademicYearService;

