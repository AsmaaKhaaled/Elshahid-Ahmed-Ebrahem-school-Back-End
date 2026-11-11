import { AcademicYearService } from './academic-year.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class AcademicYearController {
  /**
   * ① GET /api/v1/academic-year/current
   */
  static async getCurrentTerm(req, res, next) {
    try {
      const data = await AcademicYearService.getCurrentTerm();
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Current academic term retrieved successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ② GET /api/v1/academic-year
   */
  static async getAllTerms(req, res, next) {
    try {
      const data = await AcademicYearService.getAllTerms();
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Academic terms retrieved successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ③ POST /api/v1/academic-year/transition
   */
  static async transitionToNextTerm(req, res, next) {
    try {
      const data = await AcademicYearService.transitionToNextTerm();
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم إنهاء الفصل الدراسي الحالي وبدء الفصل التالي بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ④ POST /api/v1/academic-year/next
   */
  static async addNextTerm(req, res, next) {
    try {
      const data = await AcademicYearService.addNextTerm(req.body);
      return ApiResponse.created(res, data, 'تم إضافة الفصل الدراسي القادم بنجاح');
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⑤ PATCH /api/v1/academic-year/terms/:id/dates
   */
  static async updatePlannedDates(req, res, next) {
    try {
      const data = await AcademicYearService.updatePlannedDates(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم تحديث التواريخ المخططة بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ⑥ DELETE /api/v1/academic-year/terms/:id
   */
  static async deleteUpcomingTerm(req, res, next) {
    try {
      const data = await AcademicYearService.deleteUpcomingTerm(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'تم حذف الفصل الدراسي القادم بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AcademicYearController;

