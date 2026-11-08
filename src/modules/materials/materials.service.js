import { prisma } from '../../config/database.js';
import { MaterialModel } from './materials.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';
import { studentClassIdOf, teachesSubjectInClass, teachingScopeOf } from '../../shared/utils/teaching-scope.js';

// ---- A teacher sees & uploads materials only for a subject they teach, in the classes they teach it to, and edits /
// ---- deletes only their own. A student sees their class's materials (and school-wide ones). The administration: all.

const UPDATABLE_FIELDS = ['title', 'type', 'subjectId', 'classId', 'month', 'fileUrl', 'fileName', 'fileSize', 'description'];

const assertTeaches = async (user, subjectId, classId) => {
  const scope = await teachingScopeOf(user);
  if (!scope) return;
  // A material without a class goes to the whole school: the administration's
  if (!classId) throw AppError.forbidden('حدد الفصل: لا يمكن للمعلم رفع مادة لكل فصول المدرسة');
  const [subject, cls] = await Promise.all([
    prisma.subject.findUnique({ where: { id: subjectId }, select: { nameArabic: true } }),
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
  ]);
  if (!subject || !cls || !teachesSubjectInClass(scope, subject.nameArabic, classId)) {
    throw AppError.forbidden(
      subject && cls
        ? `لا تدرّس مادة ${subject.nameArabic} لفصل ${cls.name}`
        : 'لا يمكنك رفع مواد إلا لمادتك في فصولك'
    );
  }
};

// A teacher manages only the materials they uploaded
const assertCanManage = async (user, material) => {
  if (user?.role === 'TEACHER' && material.uploadedByTeacherId !== user.id) {
    throw AppError.forbidden('لا يمكنك تعديل أو حذف مادة رفعها شخص آخر');
  }
};

/**
 * Which materials the viewer may see, as a Prisma condition:
 * - a teacher: their subjects only, for the classes they teach them to (and that subject's school-wide ones)
 * - a student: their class's materials and the school-wide ones (no class)
 * - the administration: all
 */
const visibleMaterialsWhere = async (user) => {
  if (user?.role === 'STUDENT') {
    return { OR: [{ classId: studentClassIdOf(user) ?? '__none__' }, { classId: null }] };
  }
  const scope = await teachingScopeOf(user);
  if (!scope) return {};
  // An empty OR matches nothing
  return {
    OR: [...scope.bySubject].map(([subject, classIds]) => ({
      subject: { nameArabic: subject },
      OR: [{ classId: { in: [...classIds] } }, { classId: null }],
    })),
  };
};

export class MaterialsService {
  /** One page (page & limit, default 20, at most 100) instead of the whole table. */
  static async getMaterials(query, user) {
    const { page, limit, skip, take } = parsePagination(query, 20, 100);
    const { total, items } = await MaterialModel.findPage(query, { skip, take }, await visibleMaterialsWhere(user));
    return { items, meta: buildPaginationMeta({ total, page, limit }) };
  }

  static async getMaterialById(id, user) {
    const visible = await prisma.material.findFirst({ where: { id, ...(await visibleMaterialsWhere(user)) }, select: { id: true } });
    const material = visible && (await MaterialModel.findById(id));
    if (!material) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    return material;
  }

  static async getMaterialsBySubject(subjectId) {
    return MaterialModel.findAll({ subjectId });
  }

  static async getMaterialsByClass(classId) {
    return MaterialModel.findAll({ classId });
  }

  static async createMaterial(data, user) {
    await assertTeaches(user, data.subjectId, data.classId);
    return MaterialModel.create(data);
  }

  static async updateMaterial(id, data, user) {
    const material = await prisma.material.findUnique({
      where: { id },
      select: { uploadedByTeacherId: true, subjectId: true, classId: true },
    });
    if (!material) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    await assertCanManage(user, material);

    // Only the material's own fields (not who uploaded it)
    const changes = Object.fromEntries(UPDATABLE_FIELDS.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
    // Moving it to another subject / class: that one must be the teacher's too
    if (changes.subjectId !== undefined || changes.classId !== undefined) {
      await assertTeaches(user, changes.subjectId ?? material.subjectId, changes.classId !== undefined ? changes.classId : material.classId);
    }

    const updated = await MaterialModel.update(id, changes);
    if (!updated) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteMaterial(id, user) {
    const material = await prisma.material.findUnique({ where: { id }, select: { uploadedByTeacherId: true } });
    if (!material) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    await assertCanManage(user, material);
    const deleted = await MaterialModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    return true;
  }
}

export default MaterialsService;

