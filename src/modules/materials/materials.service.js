import { MaterialModel } from './materials.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { buildPaginationMeta, parsePagination } from '../../shared/utils/pagination.js';

export class MaterialsService {
  /** One page (page & limit, default 20, at most 100) instead of the whole table. */
  static async getMaterials(query) {
    const { page, limit, skip, take } = parsePagination(query, 20, 100);
    const { total, items } = await MaterialModel.findPage(query, { skip, take });
    return { items, meta: buildPaginationMeta({ total, page, limit }) };
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

