import { MaterialsService } from './materials.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class MaterialsController {
  static async getAll(req, res, next) {
    try {
      const { items, meta } = await MaterialsService.getMaterials(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Materials retrieved successfully',
        data: items,
        meta,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const material = await MaterialsService.getMaterialById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Material retrieved successfully',
        data: material,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const payload = {
        ...req.body,
        uploadedById: req.user.id,
      };
      const material = await MaterialsService.createMaterial(payload);
      return ApiResponse.created(res, material, 'Material uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await MaterialsService.updateMaterial(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Material updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await MaterialsService.deleteMaterial(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Material deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default MaterialsController;

