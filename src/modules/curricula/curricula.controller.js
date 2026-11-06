import { CurriculaService } from './curricula.service.js';
import { sendStoredFile } from '../../shared/utils/file-storage.js';

// The signed-in teacher (routes that change a curriculum are for teachers only)
const myTeacherId = async (req) => (await CurriculaService.viewerOf(req.user)).teacherId;

export class CurriculaController {
  /**
   * GET /api/v1/curricula?page&limit&search&gradeId&subject&teacherId
   */
  static async list(req, res, next) {
    try {
      const viewer = await CurriculaService.viewerOf(req.user);
      const { curricula, gradeCounts, meta, startedSubjects } = await CurriculaService.list(viewer, req.query);
      return res.status(200).json({ status: 'success', data: { curricula, gradeCounts, ...(startedSubjects && { startedSubjects }) }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/curricula/:id
   */
  static async getById(req, res, next) {
    try {
      const viewer = await CurriculaService.viewerOf(req.user);
      const curriculum = await CurriculaService.getDetail(viewer, req.params.id);
      return res.status(200).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/curricula/:id/files?page&limit&kind
   */
  static async listFiles(req, res, next) {
    try {
      const viewer = await CurriculaService.viewerOf(req.user);
      const { files, meta } = await CurriculaService.listFiles(viewer, req.params.id, req.query);
      return res.status(200).json({ status: 'success', data: { files }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/curricula/:id/files/:fileId/download
   */
  static async downloadFile(req, res, next) {
    try {
      const viewer = await CurriculaService.viewerOf(req.user);
      sendStoredFile(res, await CurriculaService.fileForDownload(viewer, req.params.id, req.params.fileId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/curricula/:id/plan-file
   */
  static async downloadPlanFile(req, res, next) {
    try {
      const viewer = await CurriculaService.viewerOf(req.user);
      sendStoredFile(res, await CurriculaService.planFileForDownload(viewer, req.params.id));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/curricula
   */
  static async create(req, res, next) {
    try {
      const curriculum = await CurriculaService.create(await myTeacherId(req), req.body);
      return res.status(201).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/curricula/:id
   */
  static async update(req, res, next) {
    try {
      const curriculum = await CurriculaService.update(await myTeacherId(req), req.params.id, req.body);
      return res.status(200).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/curricula/:id
   */
  static async remove(req, res, next) {
    try {
      await CurriculaService.remove(await myTeacherId(req), req.params.id);
      return res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/curricula/:id/files (multipart: file + kind, title, forStudents; or a link)
   */
  static async addFile(req, res, next) {
    try {
      const file = await CurriculaService.addFile(await myTeacherId(req), req.params.id, req.body, req.file);
      return res.status(201).json({ status: 'success', data: { file } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/curricula/:id/files/:fileId
   */
  static async deleteFile(req, res, next) {
    try {
      await CurriculaService.deleteFile(await myTeacherId(req), req.params.id, req.params.fileId);
      return res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/curricula/:id/plan
   */
  static async savePlan(req, res, next) {
    try {
      const curriculum = await CurriculaService.savePlan(await myTeacherId(req), req.params.id, req.body.weeks);
      return res.status(200).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/curricula/:id/plan-file (multipart: file)
   */
  static async setPlanFile(req, res, next) {
    try {
      const curriculum = await CurriculaService.setPlanFile(await myTeacherId(req), req.params.id, req.file);
      return res.status(200).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/curricula/:id/plan-file
   */
  static async deletePlanFile(req, res, next) {
    try {
      const curriculum = await CurriculaService.deletePlanFile(await myTeacherId(req), req.params.id);
      return res.status(200).json({ status: 'success', data: { curriculum } });
    } catch (error) {
      next(error);
    }
  }
}

export default CurriculaController;
