import { ClassModel } from './classes.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class ClassesService {
  static async getClasses(query) {
    return ClassModel.findAll(query);
  }

  static async getClassById(id) {
    const cls = await ClassModel.findById(id);
    if (!cls) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return cls;
  }

  static async createClass(data) {
    return ClassModel.create(data);
  }

  static async updateClass(id, data) {
    const updated = await ClassModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteClass(id) {
    const deleted = await ClassModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return true;
  }
}

export default ClassesService;

