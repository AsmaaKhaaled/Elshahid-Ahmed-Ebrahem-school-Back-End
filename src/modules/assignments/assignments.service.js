import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';
import { classesTeachingSubject } from '../../shared/utils/teaching-scope.js';
import { keepFileIdsOf } from './assignments.validation.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_ATTACHMENTS_PER_ASSIGNMENT = 10;
export const MAX_FILES_PER_SUBMISSION = 10;

// ---- Who is asking ----
// A teacher works on their own assignments; a student sees their class's; the administration reads all.

const isAdmin = (user) => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

const visibleWhere = (viewer) => {
  if (viewer.teacherId) return { teacherId: viewer.teacherId };
  // A student without a class sees nothing
  if (viewer.classId !== undefined) return { classId: viewer.classId ?? '__none__' };
  return {};
};

const ASSIGNMENT_INCLUDE = {
  class: { select: { name: true } },
  teacher: { select: { fullNameArabic: true } },
  attachments: {
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fileName: true, fileSize: true, fileType: true },
  },
};

const SUBMISSION_INCLUDE = {
  student: { select: { fullNameArabic: true } },
  files: {
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fileName: true, fileSize: true, fileType: true },
  },
};

const toFileDto = (file) => ({ id: file.id, name: file.fileName, size: file.fileSize, type: file.fileType });

const toSubmissionDto = (row) => ({
  id: row.id,
  assignmentId: row.assignmentId,
  studentId: row.studentId,
  studentName: row.student.fullNameArabic,
  files: row.files.map(toFileDto),
  note: row.note,
  submittedAt: row.submittedAt,
  score: row.score,
  feedback: row.feedback,
});

const uploadedFileData = (upload) => ({
  fileKey: storageKey(upload),
  fileName: upload.originalname.slice(0, 255),
  fileSize: upload.size,
  fileType: upload.mimetype,
});

/** How many active students each of these classes has. */
const classSizesOf = async (rows) => {
  const groups = await prisma.student.groupBy({
    by: ['classId'],
    where: { classId: { in: [...new Set(rows.map((row) => row.classId))] }, isActive: true },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.classId, group._count._all]));
};

const submissionCounts = async (where) => {
  const groups = await prisma.assignmentSubmission.groupBy({ by: ['assignmentId'], where, _count: { _all: true } });
  return new Map(groups.map((group) => [group.assignmentId, group._count._all]));
};

/** The cards of a page, with their counts and (for a student) their own submission, in one batch. */
const toDtos = async (rows, viewer) => {
  if (!rows.length) return [];
  const assignmentId = { in: rows.map((row) => row.id) };
  const [classSizes, totals, ungraded, mine] = await Promise.all([
    classSizesOf(rows),
    submissionCounts({ assignmentId }),
    submissionCounts({ assignmentId, score: null }),
    viewer.studentId
      ? prisma.assignmentSubmission.findMany({ where: { assignmentId, studentId: viewer.studentId }, include: SUBMISSION_INCLUDE })
      : [],
  ]);
  const mineByAssignment = new Map(mine.map((row) => [row.assignmentId, toSubmissionDto(row)]));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    teacherId: row.teacherId,
    teacherName: row.teacher.fullNameArabic,
    section: row.class.name,
    publishedAt: row.publishedAt,
    dueDate: row.dueDate,
    maxScore: row.maxScore,
    requiresSubmission: row.requiresSubmission,
    attachments: row.attachments.map(toFileDto),
    totalSubmissions: totals.get(row.id) ?? 0,
    ungradedSubmissions: ungraded.get(row.id) ?? 0,
    totalStudents: classSizes.get(row.classId) ?? 0,
    ...(viewer.studentId && { mySubmission: mineByAssignment.get(row.id) ?? null }),
  }));
};

/** Removes the stored files no attachment row points to any more. */
const removeUnusedFiles = async (keys) => {
  const unique = [...new Set(keys)];
  if (!unique.length) return;
  const stillUsed = await prisma.assignmentAttachment.findMany({
    where: { fileKey: { in: unique } },
    select: { fileKey: true },
    distinct: ['fileKey'],
  });
  const used = new Set(stillUsed.map((row) => row.fileKey));
  await removeStoredFiles(unique.filter((key) => !used.has(key)));
};

export class AssignmentsService {
  /** The viewer of a request: { teacherId } | { studentId, classId } | {} (the administration). */
  static viewerOf(user) {
    if (user.role === 'TEACHER') {
      if (!user.teacherProfile?.id) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');
      return { teacherId: user.teacherProfile.id };
    }
    if (user.role === 'STUDENT') return { studentId: user.id, classId: user.studentProfile?.classId ?? null };
    if (isAdmin(user)) return {};
    throw AppError.forbidden('غير مصرح لك بالوصول لهذا القسم');
  }

  // ---------- Reading ----------

  /** One page of the assignments the viewer may see, newest first. */
  static async list(viewer, query) {
    const { page, limit, skip, take } = parsePagination(query, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const where = {
      ...visibleWhere(viewer),
      ...(query.subject && { subject: query.subject }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };
    const [total, rows] = await Promise.all([
      prisma.assignment.count({ where }),
      prisma.assignment.findMany({
        where,
        include: ASSIGNMENT_INCLUDE,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
    ]);
    return { assignments: await toDtos(rows, viewer), meta: buildPaginationMeta({ total, page, limit }) };
  }

  static async getById(viewer, id) {
    const row = await prisma.assignment.findFirst({ where: { id, ...visibleWhere(viewer) }, include: ASSIGNMENT_INCLUDE });
    if (!row) throw AppError.notFound('الواجب غير موجود');
    const [assignment] = await toDtos([row], viewer);
    return assignment;
  }

  /** What to stream for an attachment download, if the viewer may have it. */
  static async attachmentForDownload(viewer, id, attachmentId) {
    const file = await prisma.assignmentAttachment.findFirst({
      where: { id: attachmentId, assignmentId: id, assignment: visibleWhere(viewer) },
      select: { fileKey: true, fileName: true, fileType: true },
    });
    if (!file) throw AppError.notFound('الملف غير موجود');
    return { key: file.fileKey, name: file.fileName, type: file.fileType };
  }

  /** Every submission of an assignment, newest first (its teacher and the administration). */
  static async listSubmissions(viewer, id) {
    const assignment = await prisma.assignment.findFirst({ where: { id, ...visibleWhere(viewer) }, select: { id: true } });
    if (!assignment) throw AppError.notFound('الواجب غير موجود');
    const rows = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: id },
      include: SUBMISSION_INCLUDE,
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toSubmissionDto);
  }

  /** A file of a submission: for the student who handed it in, the teacher, and the administration. */
  static async submissionFileForDownload(viewer, id, submissionId, fileId) {
    const owner = viewer.studentId ? { studentId: viewer.studentId } : { assignment: visibleWhere(viewer) };
    const file = await prisma.assignmentSubmissionFile.findFirst({
      where: { id: fileId, submission: { id: submissionId, assignmentId: id, ...owner } },
      select: { fileKey: true, fileName: true, fileType: true },
    });
    if (!file) throw AppError.notFound('الملف غير موجود');
    return { key: file.fileKey, name: file.fileName, type: file.fileType };
  }

  // ---------- The teacher's own assignments ----------

  /** Publishes to each chosen class: one assignment per class. */
  static async create(teacherId, body) {
    const taught = await this.classesTeaching(teacherId, body.subject.trim());
    const sections = [...new Set(body.sections)];
    const foreign = sections.filter((section) => !taught.some((cls) => cls.name === section));
    if (foreign.length) throw AppError.badRequest(`هذه الفصول ليست من فصولك في هذه المادة: ${foreign.join('، ')}`);

    const data = this.fields(body);
    const created = await prisma.$transaction(
      sections.map((section) =>
        prisma.assignment.create({
          data: { ...data, teacherId, classId: taught.find((cls) => cls.name === section).id },
          include: ASSIGNMENT_INCLUDE,
        })
      )
    );
    return toDtos(created, { teacherId });
  }

  static async update(teacherId, id, body) {
    const current = await this.ownedBy(teacherId, id);
    const taught = await this.classesTeaching(teacherId, body.subject.trim());
    if (!taught.some((cls) => cls.id === current.classId)) {
      throw AppError.badRequest('هذا الفصل ليس من فصولك في هذه المادة');
    }
    if (body.maxScore !== undefined) {
      const top = await prisma.assignmentSubmission.aggregate({ where: { assignmentId: id }, _max: { score: true } });
      if (top._max.score !== null && body.maxScore < top._max.score) {
        throw AppError.badRequest(`لا يمكن جعل الدرجة النهائية أقل من درجة مرصودة (${top._max.score})`);
      }
    }
    await prisma.assignment.update({ where: { id }, data: this.fields(body) });
    return this.getById({ teacherId }, id);
  }

  /** Deletes the assignment, its attachments and submissions, and the stored files no other class uses. */
  static async remove(teacherId, id) {
    await this.ownedBy(teacherId, id);
    const [files, answers] = await Promise.all([
      prisma.assignmentAttachment.findMany({ where: { assignmentId: id }, select: { fileKey: true } }),
      prisma.assignmentSubmissionFile.findMany({ where: { submission: { assignmentId: id } }, select: { fileKey: true } }),
    ]);
    await prisma.assignment.delete({ where: { id } });
    await removeUnusedFiles(files.map((file) => file.fileKey));
    await removeStoredFiles(answers.map((file) => file.fileKey));
  }

  /** Attaches an uploaded file to the assignment and, stored once, to its copies in other classes. */
  static async addAttachment(teacherId, id, upload, alsoFor = []) {
    const ids = [...new Set([id, ...alsoFor])];
    const owned = await prisma.assignment.findMany({
      where: { id: { in: ids }, teacherId },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (owned.length !== ids.length) throw AppError.notFound('الواجب غير موجود ضمن واجباتك');
    if (owned.some((row) => row._count.attachments >= MAX_ATTACHMENTS_PER_ASSIGNMENT)) {
      throw AppError.badRequest(`الواجب وصل للحد الأقصى (${MAX_ATTACHMENTS_PER_ASSIGNMENT} ملفات)`);
    }
    const file = uploadedFileData(upload);
    const created = await prisma.$transaction(
      ids.map((assignmentId) => prisma.assignmentAttachment.create({ data: { ...file, assignmentId } }))
    );
    return created.map((row) => ({ ...toFileDto(row), assignmentId: row.assignmentId }));
  }

  static async deleteAttachment(teacherId, id, attachmentId) {
    await this.ownedBy(teacherId, id);
    const file = await prisma.assignmentAttachment.findFirst({
      where: { id: attachmentId, assignmentId: id },
      select: { fileKey: true },
    });
    if (!file) throw AppError.notFound('الملف غير موجود');
    await prisma.assignmentAttachment.delete({ where: { id: attachmentId } });
    await removeUnusedFiles([file.fileKey]);
  }

  /** The teacher marks a submission: 0 to the assignment's final score, marking again replaces it. */
  static async grade(teacherId, id, submissionId, body) {
    const assignment = await prisma.assignment.findFirst({ where: { id, teacherId }, select: { maxScore: true } });
    if (!assignment) throw AppError.notFound('الواجب غير موجود ضمن واجباتك');
    if (body.score > assignment.maxScore) {
      throw AppError.badRequest(`الدرجة يجب ألا تزيد عن ${assignment.maxScore}`);
    }
    const submission = await prisma.assignmentSubmission.findFirst({ where: { id: submissionId, assignmentId: id }, select: { id: true } });
    if (!submission) throw AppError.notFound('التسليم غير موجود');
    const row = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { score: body.score, feedback: (body.feedback ?? '').trim(), gradedAt: new Date() },
      include: SUBMISSION_INCLUDE,
    });
    return toSubmissionDto(row);
  }

  // ---------- The student's answer ----------

  /**
   * Hands in (or replaces) the student's answer. keepFileIds: the files of the previous one to keep.
   * Open while the teacher asks for it on the platform, until the due date and the marking.
   */
  static async submit(viewer, id, body, uploads = []) {
    const assignment = await prisma.assignment.findFirst({
      where: { id, ...visibleWhere(viewer) },
      select: { dueDate: true, requiresSubmission: true },
    });
    if (!assignment) throw AppError.notFound('الواجب غير موجود');
    if (!assignment.requiresSubmission) throw AppError.badRequest('هذا الواجب لا يتطلب التسليم على المنصة');
    if (assignment.dueDate.getTime() < Date.now()) throw AppError.badRequest('انتهى موعد تسليم هذا الواجب');

    const key = { assignmentId_studentId: { assignmentId: id, studentId: viewer.studentId } };
    const previous = await prisma.assignmentSubmission.findUnique({
      where: key,
      select: { score: true, files: { select: { id: true, fileKey: true } } },
    });
    if (previous && previous.score !== null) throw AppError.badRequest('تم تصحيح هذا الواجب ولا يمكن إعادة تسليمه');

    const keepIds = new Set(keepFileIdsOf(body));
    const kept = previous?.files.filter((file) => keepIds.has(file.id)) ?? [];
    const dropped = previous?.files.filter((file) => !keepIds.has(file.id)) ?? [];
    const note = (body.note ?? '').trim();
    if (!note && !kept.length && !uploads.length) throw AppError.badRequest('ارفع ملفًا أو اكتب إجابتك');
    if (kept.length + uploads.length > MAX_FILES_PER_SUBMISSION) {
      throw AppError.badRequest(`يمكن رفع ${MAX_FILES_PER_SUBMISSION} ملفات على الأكثر`);
    }

    const newFiles = uploads.map(uploadedFileData);
    const row = await prisma.assignmentSubmission.upsert({
      where: key,
      create: { assignmentId: id, studentId: viewer.studentId, note, files: { create: newFiles } },
      update: {
        note,
        submittedAt: new Date(),
        files: { deleteMany: { id: { in: dropped.map((file) => file.id) } }, create: newFiles },
      },
      include: SUBMISSION_INCLUDE,
    });
    await removeStoredFiles(dropped.map((file) => file.fileKey));
    return toSubmissionDto(row);
  }

  // ---------- helpers ----------

  static fields(body) {
    return {
      title: body.title.trim(),
      description: (body.description ?? '').trim(),
      subject: body.subject.trim(),
      dueDate: new Date(body.dueDate),
      ...(body.maxScore !== undefined && { maxScore: body.maxScore }),
      ...(body.requiresSubmission !== undefined && { requiresSubmission: body.requiresSubmission }),
    };
  }

  static async ownedBy(teacherId, id) {
    const row = await prisma.assignment.findFirst({ where: { id, teacherId }, select: { classId: true } });
    if (!row) throw AppError.notFound('الواجب غير موجود ضمن واجباتك');
    return row;
  }

  static classesTeaching(teacherId, subject) {
    return classesTeachingSubject(teacherId, subject);
  }
}

export default AssignmentsService;
