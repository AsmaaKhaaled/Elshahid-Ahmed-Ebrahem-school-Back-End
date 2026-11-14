import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { removeStoredFiles, storageKey } from '../../shared/utils/file-storage.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';
import { classesTeachingSubject } from '../../shared/utils/teaching-scope.js';
import { MAX_FILES_PER_MATERIAL, keepFileIdsOf, linkOf, sectionsOf } from './materials.validation.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ---- Who is asking ----
// A teacher works on their own materials; a student sees their class's as soon as they're saved;
// the administration reads all.

const isAdmin = (user) => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

const visibleWhere = (viewer) => {
  if (viewer.teacherId) return { teacherId: viewer.teacherId };
  // A student without a class sees nothing
  if (viewer.classId !== undefined) return { classes: { some: { id: viewer.classId ?? '__none__' } } };
  return {};
};

const MATERIAL_INCLUDE = {
  teacher: { select: { fullNameArabic: true } },
  classes: { select: { name: true }, orderBy: { name: 'asc' } },
  files: {
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fileName: true, fileSize: true, fileType: true },
  },
};

const toFileDto = (file) => ({ id: file.id, name: file.fileName, size: file.fileSize, type: file.fileType });

const toDto = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  subject: row.subject,
  teacherId: row.teacherId,
  teacherName: row.teacher.fullNameArabic,
  sections: row.classes.map((cls) => cls.name),
  files: row.files.map(toFileDto),
  link: row.link,
  publishedAt: row.publishedAt,
  updatedAt: row.updatedAt,
});

const uploadedFileData = (upload) => ({
  fileKey: storageKey(upload),
  fileName: upload.originalname.slice(0, 255),
  fileSize: upload.size,
  fileType: upload.mimetype,
});

export class MaterialsService {
  /** The viewer of a request: { teacherId } | { classId } (a student) | {} (the administration). */
  static viewerOf(user) {
    if (user.role === 'TEACHER') {
      if (!user.teacherProfile?.id) throw AppError.forbidden('هذا الحساب غير مرتبط بملف معلم');
      return { teacherId: user.teacherProfile.id };
    }
    if (user.role === 'STUDENT') return { classId: user.studentProfile?.classId ?? null };
    if (isAdmin(user)) return {};
    throw AppError.forbidden('غير مصرح لك بالوصول لهذا القسم');
  }

  // ---------- Reading ----------

  /** One page of the materials the viewer may see, newest first, and how many there are of each subject. */
  static async list(viewer, query) {
    const { page, limit, skip, take } = parsePagination(query, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const visible = visibleWhere(viewer);
    const where = {
      ...visible,
      ...(query.subject && { subject: query.subject }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [total, rows, bySubject] = await Promise.all([
      prisma.material.count({ where }),
      prisma.material.findMany({
        where,
        include: MATERIAL_INCLUDE,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      // The subject tabs: every subject the viewer has materials in, whatever the page
      prisma.material.groupBy({ by: ['subject'], where: visible, _count: { _all: true }, orderBy: { subject: 'asc' } }),
    ]);
    return {
      materials: rows.map(toDto),
      subjects: bySubject.map((group) => ({ subject: group.subject, count: group._count._all })),
      meta: buildPaginationMeta({ total, page, limit }),
    };
  }

  static async getById(viewer, id) {
    const row = await prisma.material.findFirst({ where: { id, ...visibleWhere(viewer) }, include: MATERIAL_INCLUDE });
    if (!row) throw AppError.notFound('المادة غير موجودة');
    return toDto(row);
  }

  /** What to stream for a file download, if the viewer may have it. */
  static async fileForDownload(viewer, id, fileId) {
    const file = await prisma.materialFile.findFirst({
      where: { id: fileId, materialId: id, material: visibleWhere(viewer) },
      select: { fileKey: true, fileName: true, fileType: true },
    });
    if (!file) throw AppError.notFound('الملف غير موجود');
    return { key: file.fileKey, name: file.fileName, type: file.fileType };
  }

  // ---------- The teacher's own materials ----------

  /** Publishes to the chosen classes: their students see it right away. */
  static async create(teacherId, body, uploads = []) {
    const classIds = await this.classIdsFor(teacherId, body);
    if (!uploads.length && !linkOf(body)) throw AppError.badRequest('ارفع ملفًا أو أضف رابطًا');

    const row = await prisma.material.create({
      data: {
        ...this.fields(body),
        teacherId,
        classes: { connect: classIds.map((id) => ({ id })) },
        files: { create: uploads.map(uploadedFileData) },
      },
      include: MATERIAL_INCLUDE,
    });
    return toDto(row);
  }

  /** Saves the edits. keepFileIds: the material's files to keep; uploads: the files added. */
  static async update(teacherId, id, body, uploads = []) {
    const current = await prisma.material.findFirst({
      where: { id, teacherId },
      select: { files: { select: { id: true, fileKey: true } } },
    });
    if (!current) throw AppError.notFound('المادة غير موجودة ضمن موادك');
    const classIds = await this.classIdsFor(teacherId, body);

    const keepIds = new Set(keepFileIdsOf(body));
    const kept = current.files.filter((file) => keepIds.has(file.id));
    const dropped = current.files.filter((file) => !keepIds.has(file.id));
    if (!kept.length && !uploads.length && !linkOf(body)) throw AppError.badRequest('ارفع ملفًا أو أضف رابطًا');
    if (kept.length + uploads.length > MAX_FILES_PER_MATERIAL) {
      throw AppError.badRequest(`يمكن إرفاق ${MAX_FILES_PER_MATERIAL} ملفات على الأكثر`);
    }

    const row = await prisma.material.update({
      where: { id },
      data: {
        ...this.fields(body),
        classes: { set: classIds.map((classId) => ({ id: classId })) },
        files: { deleteMany: { id: { in: dropped.map((file) => file.id) } }, create: uploads.map(uploadedFileData) },
      },
      include: MATERIAL_INCLUDE,
    });
    await removeStoredFiles(dropped.map((file) => file.fileKey));
    return toDto(row);
  }

  /** Deletes the material and its stored files. */
  static async remove(teacherId, id) {
    const current = await prisma.material.findFirst({
      where: { id, teacherId },
      select: { files: { select: { fileKey: true } } },
    });
    if (!current) throw AppError.notFound('المادة غير موجودة ضمن موادك');
    await prisma.material.delete({ where: { id } });
    await removeStoredFiles(current.files.map((file) => file.fileKey));
  }

  // ---------- helpers ----------

  static fields(body) {
    return {
      title: body.title.trim(),
      description: (body.description ?? '').trim(),
      subject: body.subject.trim(),
      link: linkOf(body) || null,
    };
  }

  /** The ids of the chosen classes: each must be one the teacher teaches this subject to. */
  static async classIdsFor(teacherId, body) {
    const taught = await classesTeachingSubject(teacherId, body.subject.trim());
    const sections = [...new Set(sectionsOf(body))];
    const foreign = sections.filter((section) => !taught.some((cls) => cls.name === section));
    if (foreign.length) throw AppError.badRequest(`هذه الفصول ليست من فصولك في هذه المادة: ${foreign.join('، ')}`);
    return sections.map((section) => taught.find((cls) => cls.name === section).id);
  }
}

export default MaterialsService;
