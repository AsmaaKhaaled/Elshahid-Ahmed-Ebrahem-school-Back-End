import { prisma } from '../../config/database.js';
import { SubjectModel } from './subjects.model.js';
import { AppError } from '../../shared/errors/app-error.js';

// One row per subject name (the school's list)
const assertNameFree = async (nameArabic, id = null) => {
  if (nameArabic === undefined) return;
  const taken = await prisma.subject.findFirst({
    where: { nameArabic: nameArabic.trim(), ...(id && { id: { not: id } }) },
    select: { id: true },
  });
  if (taken) {
    throw AppError.conflict(`المادة '${nameArabic.trim()}' مسجلة بالفعل`);
  }
};

export class SubjectsService {
  static async getSubjects(query) {
    return SubjectModel.findAll(query);
  }

  static async getSubjectById(id) {
    const subject = await SubjectModel.findById(id);
    if (!subject) {
      throw AppError.notFound(`Subject with id '${id}' not found`);
    }
    return subject;
  }

  static async createSubject(data) {
    const existing = await SubjectModel.findByCode(data.code);
    if (existing) {
      throw AppError.conflict(`Subject with code '${data.code}' already exists`);
    }
    await assertNameFree(data.nameArabic);
    return SubjectModel.create({ ...data, nameArabic: data.nameArabic.trim() });
  }

  static async updateSubject(id, data) {
    if (data.code) {
      const existing = await SubjectModel.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw AppError.conflict(`Subject with code '${data.code}' already exists`);
      }
    }
    await assertNameFree(data.nameArabic, id);
    const updated = await SubjectModel.update(id, {
      ...data,
      ...(data.nameArabic !== undefined && { nameArabic: data.nameArabic.trim() }),
    });
    if (!updated) {
      throw AppError.notFound(`Subject with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteSubject(id) {
    const deleted = await SubjectModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Subject with id '${id}' not found`);
    }
    return true;
  }
}

export default SubjectsService;

