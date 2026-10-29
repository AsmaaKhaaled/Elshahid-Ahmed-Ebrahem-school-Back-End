import { SubjectModel } from './subjects.model.js';
import { AppError } from '../../shared/errors/app-error.js';

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
    return SubjectModel.create(data);
  }

  static async updateSubject(id, data) {
    if (data.code) {
      const existing = await SubjectModel.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw AppError.conflict(`Subject with code '${data.code}' already exists`);
      }
    }
    const updated = await SubjectModel.update(id, data);
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

