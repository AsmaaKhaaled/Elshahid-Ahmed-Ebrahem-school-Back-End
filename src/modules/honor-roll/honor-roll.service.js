import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';

export class HonorRollService {
  /**
   * ① Autocomplete Search Candidates (Teachers or Students)
   * @param {Object} params
   * @param {'TEACHER'|'STUDENT'} params.type
   * @param {string} [params.q]
   * @param {number} [params.limit=10]
   */
  static async searchCandidates({ type, q = '', limit = 10 }) {
    const normalizedType = String(type).toUpperCase();
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const searchTerm = typeof q === 'string' ? q.trim() : '';

    if (normalizedType === 'STUDENT') {
      const where = {
        isActive: true,
      };

      if (searchTerm.length > 0) {
        where.OR = [
          { fullNameArabic: { contains: searchTerm, mode: 'insensitive' } },
          { studentCode: { contains: searchTerm, mode: 'insensitive' } },
          { nationalId: { contains: searchTerm } },
        ];
      }

      const students = await prisma.student.findMany({
        where,
        take,
        orderBy: { fullNameArabic: 'asc' },
        select: {
          id: true,
          fullNameArabic: true,
          studentCode: true,
          gradeLevel: true,
          class: {
            select: {
              id: true,
              name: true,
              displayNameArabic: true,
              gradeLevel: true,
            },
          },
        },
      });

      return students.map((student) => ({
        id: student.id,
        name: student.fullNameArabic,
        studentCode: student.studentCode,
        section: student.class?.name || null,
        gradeLevel: student.gradeLevel || student.class?.displayNameArabic || null,
        photoUrl: null,
      }));
    }

    if (normalizedType === 'TEACHER') {
      const where = {
        isActive: true,
      };

      if (searchTerm.length > 0) {
        where.OR = [
          { fullNameArabic: { contains: searchTerm, mode: 'insensitive' } },
          { specialization: { contains: searchTerm, mode: 'insensitive' } },
          { teacherCode: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      const teachers = await prisma.teacher.findMany({
        where,
        take,
        orderBy: { fullNameArabic: 'asc' },
        select: {
          id: true,
          fullNameArabic: true,
          teacherCode: true,
          specialization: true,
          jobTitle: true,
          teachingSubjects: true,
        },
      });

      return teachers.map((teacher) => {
        // Build subjects array: prefer teachingSubjects if populated, fallback to specialization
        let subjects = [];
        if (Array.isArray(teacher.teachingSubjects) && teacher.teachingSubjects.length > 0) {
          subjects = teacher.teachingSubjects;
        } else if (teacher.specialization && teacher.specialization.trim().length > 0) {
          subjects = [teacher.specialization.trim()];
        }

        return {
          id: teacher.id,
          name: teacher.fullNameArabic,
          teacherCode: teacher.teacherCode,
          specialization: teacher.specialization,
          jobTitle: teacher.jobTitle || (teacher.specialization ? `معلم ${teacher.specialization}` : 'معلم'),
          subjects,
          photoUrl: null,
        };
      });
    }

    throw AppError.badRequest('نوع البحث غير صالح');
  }

  /**
   * ② Get Honor Roll List
   * @param {Object} query
   * @param {string} [query.kind]
   * @param {string} [query.academicYear]
   * @param {string} [query.term]
   * @param {string|boolean} [query.isActive]
   */
  static async getHonorRoll(query = {}) {
    const { kind, academicYear, term, isActive } = query;
    const where = {};

    if (kind && ['TEACHER', 'STUDENT'].includes(String(kind).toUpperCase())) {
      where.kind = String(kind).toUpperCase();
    }

    if (academicYear) {
      where.academicYear = academicYear;
    }

    if (term) {
      where.term = term;
    }

    // Default to active only unless explicitly asked (e.g. isActive=all or false)
    if (isActive !== undefined) {
      if (isActive !== 'all') {
        where.isActive = isActive === 'true' || isActive === true;
      }
    } else {
      where.isActive = true;
    }

    const entries = await prisma.honorRoll.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            specialization: true,
            jobTitle: true,
          },
        },
        student: {
          select: {
            id: true,
            studentCode: true,
            gradeLevel: true,
            class: {
              select: {
                id: true,
                name: true,
                displayNameArabic: true,
              },
            },
          },
        },
      },
    });

    const formatEntry = (entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: entry.name,
      photoUrl: entry.photoUrl,
      teacherId: entry.teacherId,
      studentId: entry.studentId,
      subjects: entry.subjects || [],
      section: entry.section,
      achievement: entry.achievement,
      academicYear: entry.academicYear,
      term: entry.term,
      order: entry.order,
      isActive: entry.isActive,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      meta: {
        teacherCode: entry.teacher?.teacherCode || null,
        studentCode: entry.student?.studentCode || null,
        gradeLevel: entry.student?.gradeLevel || null,
        className: entry.student?.class?.name || null,
      },
    });

    const teachers = entries.filter((e) => e.kind === 'TEACHER').map(formatEntry);
    const students = entries.filter((e) => e.kind === 'STUDENT').map(formatEntry);

    return {
      teachers,
      students,
      total: entries.length,
    };
  }

  /**
   * Get single honor roll entry by ID
   * @param {string} id
   */
  static async getById(id) {
    const entry = await prisma.honorRoll.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            specialization: true,
            jobTitle: true,
          },
        },
        student: {
          select: {
            id: true,
            studentCode: true,
            gradeLevel: true,
            class: {
              select: {
                id: true,
                name: true,
                displayNameArabic: true,
              },
            },
          },
        },
      },
    });

    if (!entry) {
      throw AppError.notFound('لم يتم العثور على المكرم المطلوب');
    }

    return entry;
  }

  /**
   * ③ Create Honor Entry
   * @param {Object} data
   */
  static async create(data) {
    const kind = String(data.kind).toUpperCase();
    const name = data.name.trim();

    // Verify teacherId or studentId if provided
    let teacherId = data.teacherId || null;
    let studentId = data.studentId || null;

    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
      if (!teacher) {
        teacherId = null;
      }
    }

    if (studentId) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      if (!student) {
        studentId = null;
      }
    }

    // Clean subjects array
    const rawSubjects = Array.isArray(data.subjects) ? data.subjects : [];
    const subjects = rawSubjects
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);

    const section = data.section ? String(data.section).trim() : null;

    const entry = await prisma.honorRoll.create({
      data: {
        kind,
        name,
        photoUrl: data.photoUrl ? String(data.photoUrl).trim() : null,
        teacherId,
        studentId,
        subjects: kind === 'TEACHER' ? subjects : [],
        section: kind === 'STUDENT' ? section : null,
        achievement: data.achievement ? String(data.achievement).trim() : null,
        academicYear: data.academicYear ? String(data.academicYear).trim() : '2026/2027',
        term: data.term ? String(data.term).trim() : 'الفصل الدراسي الأول',
        order: typeof data.order === 'number' ? data.order : 0,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    return entry;
  }

  /**
   * ④ Update Honor Entry
   * @param {string} id
   * @param {Object} data
   */
  static async update(id, data) {
    const existing = await prisma.honorRoll.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('المكرم المطلوب غير موجود');
    }

    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = String(data.name).trim();
    }

    if (data.kind !== undefined) {
      updateData.kind = String(data.kind).toUpperCase();
    }

    const effectiveKind = updateData.kind || existing.kind;

    if (data.photoUrl !== undefined) {
      updateData.photoUrl = data.photoUrl ? String(data.photoUrl).trim() : null;
    }

    if (data.teacherId !== undefined) {
      updateData.teacherId = data.teacherId || null;
    }

    if (data.studentId !== undefined) {
      updateData.studentId = data.studentId || null;
    }

    if (data.subjects !== undefined) {
      const rawSubjects = Array.isArray(data.subjects) ? data.subjects : [];
      updateData.subjects = rawSubjects
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0);
    }

    if (data.section !== undefined) {
      updateData.section = data.section ? String(data.section).trim() : null;
    }

    if (data.achievement !== undefined) {
      updateData.achievement = data.achievement ? String(data.achievement).trim() : null;
    }

    if (data.academicYear !== undefined) {
      updateData.academicYear = data.academicYear ? String(data.academicYear).trim() : '2026/2027';
    }

    if (data.term !== undefined) {
      updateData.term = data.term ? String(data.term).trim() : 'الفصل الدراسي الأول';
    }

    if (data.order !== undefined) {
      updateData.order = parseInt(data.order, 10) || 0;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = Boolean(data.isActive);
    }

    // Business consistency checks
    if (effectiveKind === 'STUDENT' && updateData.section === null && !existing.section) {
      throw AppError.unprocessableEntity('الفصل الدراسي مطلوب للطالب المكرم');
    }

    if (
      effectiveKind === 'TEACHER' &&
      updateData.subjects &&
      updateData.subjects.length === 0
    ) {
      throw AppError.unprocessableEntity('يجب تحديد مادة واحدة على الأقل للمعلم المكرم');
    }

    const updated = await prisma.honorRoll.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  /**
   * ⑤ Delete Honor Entry
   * @param {string} id
   */
  static async delete(id) {
    const existing = await prisma.honorRoll.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('المكرم المطلوب غير موجود');
    }

    await prisma.honorRoll.delete({ where: { id } });
    return { id };
  }

  /**
   * Quick toggle active status
   * @param {string} id
   */
  static async toggleActive(id) {
    const existing = await prisma.honorRoll.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound('المكرم المطلوب غير موجود');
    }

    return prisma.honorRoll.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  /**
   * Bulk reorder entries
   * @param {Array<{ id: string, order: number }>} items
   */
  static async reorder(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw AppError.badRequest('قائمة الترتيب غير صالحة');
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.honorRoll.update({
          where: { id: item.id },
          data: { order: parseInt(item.order, 10) || 0 },
        })
      )
    );

    return { message: 'تم تحديث الترتيب بنجاح' };
  }
}

export default HonorRollService;

