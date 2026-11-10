import { AssignmentsService } from './assignments.service.js';
import { alsoForIds } from './assignments.validation.js';
import { sendStoredFile } from '../../shared/utils/file-storage.js';

const myTeacherId = (req) => AssignmentsService.viewerOf(req.user).teacherId;

export class AssignmentsController {
  /**
   * GET /api/v1/assignments?page&limit&search&subject
   */
  static async list(req, res, next) {
    try {
      const { assignments, meta } = await AssignmentsService.list(AssignmentsService.viewerOf(req.user), req.query);
      return res.status(200).json({ status: 'success', data: { assignments }, meta });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id
   */
  static async getById(req, res, next) {
    try {
      const assignment = await AssignmentsService.getById(AssignmentsService.viewerOf(req.user), req.params.id);
      return res.status(200).json({ status: 'success', data: { assignment } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments
   */
  static async create(req, res, next) {
    try {
      const assignments = await AssignmentsService.create(myTeacherId(req), req.body);
      return res.status(201).json({ status: 'success', data: { assignments } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/assignments/:id
   */
  static async update(req, res, next) {
    try {
      const assignment = await AssignmentsService.update(myTeacherId(req), req.params.id, req.body);
      return res.status(200).json({ status: 'success', data: { assignment } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/assignments/:id
   */
  static async remove(req, res, next) {
    try {
      await AssignmentsService.remove(myTeacherId(req), req.params.id);
      return res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/attachments (multipart: file, alsoFor?)
   */
  static async addAttachment(req, res, next) {
    try {
      const attachments = await AssignmentsService.addAttachment(myTeacherId(req), req.params.id, req.file, alsoForIds(req.body));
      return res.status(201).json({ status: 'success', data: { attachments } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id/attachments/:attachmentId/download
   */
  static async downloadAttachment(req, res, next) {
    try {
      const viewer = AssignmentsService.viewerOf(req.user);
      sendStoredFile(res, await AssignmentsService.attachmentForDownload(viewer, req.params.id, req.params.attachmentId));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/assignments/:id/attachments/:attachmentId
   */
  static async deleteAttachment(req, res, next) {
    try {
      await AssignmentsService.deleteAttachment(myTeacherId(req), req.params.id, req.params.attachmentId);
      return res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/submission (multipart: files, note?, keepFileIds?)
   */
  static async submit(req, res, next) {
    try {
      const viewer = AssignmentsService.viewerOf(req.user);
      const submission = await AssignmentsService.submit(viewer, req.params.id, req.body, req.files);
      return res.status(200).json({ status: 'success', data: { submission } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id/submissions
   */
  static async listSubmissions(req, res, next) {
    try {
      const submissions = await AssignmentsService.listSubmissions(AssignmentsService.viewerOf(req.user), req.params.id);
      return res.status(200).json({ status: 'success', data: { submissions } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/assignments/:id/submissions/:submissionId/grade
   */
  static async grade(req, res, next) {
    try {
      const submission = await AssignmentsService.grade(myTeacherId(req), req.params.id, req.params.submissionId, req.body);
      return res.status(200).json({ status: 'success', data: { submission } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id/submissions/:submissionId/files/:fileId/download
   */
  static async downloadSubmissionFile(req, res, next) {
    try {
      const { id, submissionId, fileId } = req.params;
      const viewer = AssignmentsService.viewerOf(req.user);
      sendStoredFile(res, await AssignmentsService.submissionFileForDownload(viewer, id, submissionId, fileId));
    } catch (error) {
      next(error);
    }
  }
}

export default AssignmentsController;
