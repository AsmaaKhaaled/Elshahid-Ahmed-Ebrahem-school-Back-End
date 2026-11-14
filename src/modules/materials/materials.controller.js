import { MaterialsService } from './materials.service.js';
import { sendStoredFile } from '../../shared/utils/file-storage.js';

const myTeacherId = (req) => MaterialsService.viewerOf(req.user).teacherId;

export class MaterialsController {
  /**
   * GET /api/v1/materials?page&limit&search&subject
   */
  static async list(req, res, next) {
    try {
      const { materials, subjects, meta } = await MaterialsService.list(MaterialsService.viewerOf(req.user), req.query);
      return res.status(200).json({ status: 'success', data: { materials, subjects }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/materials/:id
   */
  static async getById(req, res, next) {
    try {
      const material = await MaterialsService.getById(MaterialsService.viewerOf(req.user), req.params.id);
      return res.status(200).json({ status: 'success', data: { material } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/materials (multipart: files, title, description?, subject, sections, link?)
   */
  static async create(req, res, next) {
    try {
      const material = await MaterialsService.create(myTeacherId(req), req.body, req.files);
      return res.status(201).json({ status: 'success', data: { material } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/materials/:id (multipart: files, the same fields, keepFileIds?)
   */
  static async update(req, res, next) {
    try {
      const material = await MaterialsService.update(myTeacherId(req), req.params.id, req.body, req.files);
      return res.status(200).json({ status: 'success', data: { material } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/materials/:id
   */
  static async remove(req, res, next) {
    try {
      await MaterialsService.remove(myTeacherId(req), req.params.id);
      return res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/materials/:id/files/:fileId/download
   */
  static async downloadFile(req, res, next) {
    try {
      const viewer = MaterialsService.viewerOf(req.user);
      sendStoredFile(res, await MaterialsService.fileForDownload(viewer, req.params.id, req.params.fileId));
    } catch (error) {
      next(error);
    }
  }
}

export default MaterialsController;
