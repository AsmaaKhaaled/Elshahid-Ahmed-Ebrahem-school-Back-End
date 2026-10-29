import { MaterialModel } from './materials.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class MaterialsService {
  static async getMaterials(query) {
    return MaterialModel.findAll(query);
  }

  static async getMaterialById(id) {
    const material = await MaterialModel.findById(id);
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

  static async createMaterial(data) {
    return MaterialModel.create(data);
  }

  static async updateMaterial(id, data) {
    const updated = await MaterialModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteMaterial(id) {
    const deleted = await MaterialModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Material with id '${id}' not found`);
    }
    return true;
  }
}

export default MaterialsService;

