import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';
import { assignmentsOf } from '../teachers/teachers.service.js';
import { CURRICULUM_FILE_KINDS } from './curricula.validation.js';

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;
// Sanity limits: far above a real school's needs, low enough that nothing grows without bound
const MAX_CURRICULA_PER_TEACHER = 50;
const MAX_FILES_PER_CURRICULUM = 300;

// ---- Who is asking ----
// A teacher works on their own curricula; the administration reads every teacher's;
// a student reads their class's, without the teacher-only files and the plan.

const isAdmin = (user) => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

const visibleWhere = (viewer) => {
  if (viewer.teacherId) return { teacherId: viewer.teacherId };
  if (viewer.section !== undefined) return { sections: { has: viewer.section ?? '__none__' } };
  return {};
};

const visibleFilesWhere = (viewer) => (viewer.section !== undefined ? { forStudents: true } : {});

// Columns only: the counts, kinds, latest file and teacher names come in one parallel batch (summarize)
const SUMMARY_SELECT = {
  id: true,
  teacherId: true,
  subject: true,
  gradeId: true,
  sections: true,
  description: true,
  updatedAt: true,
};

const sortKinds = (kinds) => CURRICULUM_FILE_KINDS.filter((kind) => kinds.includes(kind));

const toFileDto = (file) => ({
  id: file.id,
  kind: file.kind,
  title: file.title,
  forStudents: file.forStudents,
  link: file.link,
  file: file.fileKey ? { name: file.fileName, size: file.fileSize, type: file.fileType } : null,
  uploadedAt: file.uploadedAt,
});

/**
 * What a card needs besides the curriculum's own columns, for a whole page at once: the file count
 * per kind, the latest file, the teacher's name. Three queries side by side, whatever the page size.
 */
const summarize = async (rows, viewer) => {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const studentFilesOnly = viewer.section !== undefined ? Prisma.sql`AND "forStudents" = true` : Prisma.empty;
  const [kindRows, latestRows, teachers] = await Promise.all([
    prisma.curriculumFile.groupBy({
      by: ['curriculumId', 'kind'],
      where: { curriculumId: { in: ids }, ...visibleFilesWhere(viewer) },
      _count: { _all: true },
    }),
    // The newest file of each curriculum, read from the (curriculumId, uploadedAt) index
    prisma.$queryRaw`
      SELECT DISTINCT ON ("curriculumId") "curriculumId", "title", "uploadedAt"
      FROM "curriculum_files"
      WHERE "curriculumId" IN (${Prisma.join(ids)}) ${studentFilesOnly}
      ORDER BY "curriculumId", "uploadedAt" DESC`,
    prisma.teacher.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.teacherId))] } },
      select: { id: true, fullNameArabic: true },
    }),
  ]);
  const names = new Map(teachers.map((t) => [t.id, t.fullNameArabic]));
  const latest = new Map(latestRows.map((f) => [f.curriculumId, { title: f.title, uploadedAt: f.uploadedAt }]));

  return rows.map((row) => {
    const counts = kindRows.filter((k) => k.curriculumId === row.id);
    const fileCounts = Object.fromEntries(counts.map((k) => [k.kind, k._count._all]));
    return {
      id: row.id,
      teacherId: row.teacherId,
      teacherName: names.get(row.teacherId) ?? '',
      subject: row.subject,
      gradeId: row.gradeId,
      sections: row.sections,
      description: row.description,
      updatedAt: row.updatedAt,
      fileCount: counts.reduce((sum, k) => sum + k._count._all, 0),
      kinds: sortKinds(Object.keys(fileCounts)),
      latestFile: latest.get(row.id) ?? null,
      fileCounts,
    };
  });
};

const uploadedFileData = (file) => ({
  fileKey: storageKey(file),
  fileName: file.originalname.slice(0, 255),
  fileSize: file.size,
  fileType: file.mimetype,
});

export class CurriculaService {
  /** The viewer of a request: { teacherId } | { section } (a student) | {} (the administration). */
  static async viewerOf(user) {
    if (user.role === 'TEACHER') {
      if (!user.teacherProfile?.id) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');
      return { teacherId: user.teacherProfile.id };
    }
    if (user.role === 'STUDENT') {
      const classId = user.studentProfile?.classId;
      const cls = classId ? await prisma.class.findUnique({ where: { id: classId }, select: { name: true } }) : null;
      // A student without a class sees nothing
      return { section: cls?.name ?? null };
    }
    if (isAdmin(user)) return {};
    throw AppError.forbidden('غير مصرح لك بالوصول لهذا القسم');
  }

  // ---------- Reading ----------

  /** One page of the curricula the viewer may see, most recently updated first. */
  static async list(viewer, query) {
    const { page, limit, skip, take } = parsePagination(query, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    // Everything but the grade, so each grade's count matches the other filters
    const anyGrade = {
      ...visibleWhere(viewer),
      ...(query.subject && { subject: query.subject }),
      // Filtering by teacher is for the administration
      ...(query.teacherId && !viewer.teacherId && viewer.section === undefined && { teacherId: query.teacherId }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { teacher: { fullNameArabic: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const where = { ...anyGrade, ...(query.gradeId && { gradeId: query.gradeId }) };

    const [total, rows, started, byGrade] = await Promise.all([
      prisma.curriculum.count({ where }),
      prisma.curriculum.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      // A teacher also needs the subjects they already started (to offer the missing ones), on any page
      viewer.teacherId
        ? prisma.curriculum.findMany({ where: { teacherId: viewer.teacherId }, select: { subject: true }, distinct: ['subject'] })
        : null,
      // How many curricula each grade has, for the grade tabs: { G1: 12, G2: 9, ... }
      prisma.curriculum.groupBy({ by: ['gradeId'], where: anyGrade, _count: { _all: true } }),
    ]);

    const curricula = (await summarize(rows, viewer)).map(({ fileCounts, ...card }) => card);
    return {
      curricula,
      gradeCounts: Object.fromEntries(byGrade.map((row) => [row.gradeId, row._count._all])),
      meta: buildPaginationMeta({ total, page, limit }),
      ...(started && { startedSubjects: started.map((row) => row.subject) }),
    };
  }

  /** One curriculum with its plan and how many files of each kind it has (the files are paged apart). */
  static async getDetail(viewer, id) {
    const isStudent = viewer.section !== undefined;
    const row = await prisma.curriculum.findFirst({
      where: { id, ...visibleWhere(viewer) },
      select: {
        ...SUMMARY_SELECT,
        planFileName: true,
        planFileSize: true,
        planFileType: true,
        planFileKey: true,
        planWeeks: isStudent
          ? false
          : { orderBy: { week: 'asc' }, select: { id: true, week: true, topic: true, objectives: true } },
      },
    });
    if (!row) throw AppError.notFound('المنهج غير موجود');

    const [summary] = await summarize([row], viewer);
    return {
      ...summary,
      // The plan & objectives are the teacher's and the administration's only
      plan: isStudent ? [] : row.planWeeks,
      planFile:
        !isStudent && row.planFileKey ? { name: row.planFileName, size: row.planFileSize, type: row.planFileType } : null,
    };
  }

  /** One page of a curriculum's files (optionally of one kind), newest first. */
  static async listFiles(viewer, id, query) {
    await this.ensureVisible(viewer, id);
    const { page, limit, skip, take } = parsePagination(query, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const where = { curriculumId: id, ...visibleFilesWhere(viewer), ...(query.kind && { kind: query.kind }) };
    const [total, files] = await Promise.all([
      prisma.curriculumFile.count({ where }),
      prisma.curriculumFile.findMany({ where, orderBy: [{ uploadedAt: 'desc' }, { id: 'asc' }], skip, take }),
    ]);
    return { files: files.map(toFileDto), meta: buildPaginationMeta({ total, page, limit }) };
  }

  /** What to stream for a file download, if the viewer may have it. */
  static async fileForDownload(viewer, id, fileId) {
    await this.ensureVisible(viewer, id);
    const file = await prisma.curriculumFile.findFirst({
      where: { id: fileId, curriculumId: id, ...visibleFilesWhere(viewer) },
      select: { fileKey: true, fileName: true, fileType: true },
    });
    if (!file?.fileKey) throw AppError.notFound('الملف غير موجود');
    return { key: file.fileKey, name: file.fileName, type: file.fileType };
  }

  static async planFileForDownload(viewer, id) {
    if (viewer.section !== undefined) throw AppError.notFound('الملف غير موجود');
    const row = await prisma.curriculum.findFirst({
      where: { id, ...visibleWhere(viewer) },
      select: { planFileKey: true, planFileName: true, planFileType: true },
    });
    if (!row?.planFileKey) throw AppError.notFound('الملف غير موجود');
    return { key: row.planFileKey, name: row.planFileName, type: row.planFileType };
  }

  // ---------- The teacher's own curricula ----------

  static async create(teacherId, body) {
    const data = await this.checkedData(teacherId, body);
    const count = await prisma.curriculum.count({ where: { teacherId } });
    if (count >= MAX_CURRICULA_PER_TEACHER) {
      throw AppError.badRequest(`وصلت للحد الأقصى (${MAX_CURRICULA_PER_TEACHER} منهج)`);
    }
    const created = await this.uniqueSave(() => prisma.curriculum.create({ data: { ...data, teacherId }, select: { id: true } }));
    return this.getDetail({ teacherId }, created.id);
  }

  static async update(teacherId, id, body) {
    await this.ownedBy(teacherId, id);
    const data = await this.checkedData(teacherId, body);
    await this.uniqueSave(() => prisma.curriculum.update({ where: { id }, data }));
    return this.getDetail({ teacherId }, id);
  }

  /** Deletes the curriculum, its files and plan, and the stored files. */
  static async remove(teacherId, id) {
    await this.ownedBy(teacherId, id);
    const [files, row] = await Promise.all([
      prisma.curriculumFile.findMany({ where: { curriculumId: id, fileKey: { not: null } }, select: { fileKey: true } }),
      prisma.curriculum.findUnique({ where: { id }, select: { planFileKey: true } }),
    ]);
    await prisma.curriculum.delete({ where: { id } });
    await removeStoredFiles([...files.map((f) => f.fileKey), row?.planFileKey]);
  }

  static async addFile(teacherId, id, body, upload) {
    await this.ownedBy(teacherId, id);
    const count = await prisma.curriculumFile.count({ where: { curriculumId: id } });
    if (count >= MAX_FILES_PER_CURRICULUM) {
      throw AppError.badRequest(`المنهج وصل للحد الأقصى (${MAX_FILES_PER_CURRICULUM} ملف)`);
    }
    const [file] = await prisma.$transaction([
      prisma.curriculumFile.create({
        data: {
          curriculumId: id,
          kind: body.kind,
          title: body.title.trim(),
          // Sent as a form field: "false" hides it from students
          forStudents: body.forStudents !== false && body.forStudents !== 'false',
          ...(upload ? uploadedFileData(upload) : { link: body.link.trim() }),
        },
      }),
      prisma.curriculum.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return toFileDto(file);
  }

  static async deleteFile(teacherId, id, fileId) {
    await this.ownedBy(teacherId, id);
    const file = await prisma.curriculumFile.findFirst({ where: { id: fileId, curriculumId: id }, select: { fileKey: true } });
    if (!file) throw AppError.notFound('الملف غير موجود');
    await prisma.$transaction([
      prisma.curriculumFile.delete({ where: { id: fileId } }),
      prisma.curriculum.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    await removeStoredFiles([file.fileKey]);
  }

  /** Replaces the whole plan, week 1, 2, 3... in the order sent. */
  static async savePlan(teacherId, id, weeks) {
    await this.ownedBy(teacherId, id);
    await prisma.$transaction([
      prisma.curriculumPlanWeek.deleteMany({ where: { curriculumId: id } }),
      prisma.curriculumPlanWeek.createMany({
        data: weeks.map((week, i) => ({
          curriculumId: id,
          week: i + 1,
          topic: week.topic.trim(),
          objectives: (week.objectives ?? []).map((o) => o.trim()),
        })),
      }),
      prisma.curriculum.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);
    return this.getDetail({ teacherId }, id);
  }

  static async setPlanFile(teacherId, id, upload) {
    if (!upload) throw AppError.unprocessableEntity('Validation failed', [{ field: 'file', message: 'Upload the plan file' }]);
    await this.ownedBy(teacherId, id);
    const old = await prisma.curriculum.findUnique({ where: { id }, select: { planFileKey: true } });
    const { fileKey, fileName, fileSize, fileType } = uploadedFileData(upload);
    await prisma.curriculum.update({
      where: { id },
      data: { planFileKey: fileKey, planFileName: fileName, planFileSize: fileSize, planFileType: fileType },
    });
    await removeStoredFiles([old?.planFileKey]);
    return this.getDetail({ teacherId }, id);
  }

  static async deletePlanFile(teacherId, id) {
    await this.ownedBy(teacherId, id);
    const old = await prisma.curriculum.findUnique({ where: { id }, select: { planFileKey: true } });
    await prisma.curriculum.update({
      where: { id },
      data: { planFileKey: null, planFileName: null, planFileSize: null, planFileType: null },
    });
    await removeStoredFiles([old?.planFileKey]);
    return this.getDetail({ teacherId }, id);
  }

  // ---------- helpers ----------

  static async ensureVisible(viewer, id) {
    const row = await prisma.curriculum.findFirst({ where: { id, ...visibleWhere(viewer) }, select: { id: true } });
    if (!row) throw AppError.notFound('المنهج غير موجود');
  }

  static async ownedBy(teacherId, id) {
    const row = await prisma.curriculum.findFirst({ where: { id, teacherId }, select: { id: true } });
    if (!row) throw AppError.notFound('المنهج غير موجود ضمن مناهجك');
  }

  /** The subject must be one the teacher teaches, the classes their own (as the admin assigned them). */
  static async checkedData(teacherId, body) {
    const [teacher, classes] = await Promise.all([
      prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { teachingSubjects: true, teachingAssignments: true, specialization: true },
      }),
      prisma.class.findMany({
        where: { isActive: true, OR: [{ assignedTeachers: { some: { id: teacherId } } }, { classTeacherId: teacherId }] },
        select: { name: true },
      }),
    ]);
    if (!teacher) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');

    const subject = body.subject.trim();
    const subjects = teacher.teachingSubjects.length ? teacher.teachingSubjects : [teacher.specialization];
    if (!subjects.includes(subject)) {
      throw AppError.badRequest('هذه المادة ليست من المواد التي تدرّسها');
    }
    // Only the classes the admin assigned for this subject (all the teacher's classes for older records)
    const subjectClasses = assignmentsOf(teacher, classes.map((cls) => cls.name)).find((a) => a.subject === subject)?.classes;
    const myClasses = new Set(subjectClasses?.length ? subjectClasses : classes.map((cls) => cls.name));
    if (!myClasses.size) {
      throw AppError.badRequest('لا توجد فصول مسجلة لك بعد، اطلب من الإدارة تعيين فصولك');
    }
    const sections = [...new Set(body.sections)].sort();
    const foreign = sections.filter((section) => !myClasses.has(section));
    if (foreign.length) {
      throw AppError.badRequest(`هذه الفصول ليست من فصولك: ${foreign.join('، ')}`);
    }
    return { subject, gradeId: body.gradeId, sections, description: (body.description ?? '').trim() };
  }

  // One curriculum per subject & grade for the same teacher
  static async uniqueSave(save) {
    try {
      return await save();
    } catch (error) {
      if (error.code === 'P2002') throw AppError.conflict('لديك منهج لهذه المادة في هذا الصف بالفعل');
      throw error;
    }
  }
}

export default CurriculaService;
