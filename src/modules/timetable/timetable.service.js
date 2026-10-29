import { TimetableModel } from './timetable.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class TimetableService {
  static async getTimetable(query) {
    return TimetableModel.findAll(query);
  }

  static async getTimetableEntryById(id) {
    const entry = await TimetableModel.findById(id);
    if (!entry) {
      throw AppError.notFound(`Timetable entry with id '${id}' not found`);
    }
    return entry;
  }

  static async getTimetableByClass(classId) {
    return TimetableModel.findAll({ classId });
  }

  static async getTimetableByTeacher(teacherId) {
    return TimetableModel.findAll({ teacherId });
  }

  static async createTimetableEntry(data) {
    return TimetableModel.create(data);
  }

  static async updateTimetableEntry(id, data) {
    const updated = await TimetableModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Timetable entry with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteTimetableEntry(id) {
    const deleted = await TimetableModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Timetable entry with id '${id}' not found`);
    }
    return true;
  }
}

export default TimetableService;
