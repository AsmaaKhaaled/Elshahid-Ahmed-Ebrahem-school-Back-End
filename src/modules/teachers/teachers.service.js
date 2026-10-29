import { TeacherModel } from './teachers.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class TeachersService {
  static async getTeachers(query) {
    return TeacherModel.findAll(query);
  }

  static async getTeacherById(id) {
    const teacher = await TeacherModel.findById(id);
    if (!teacher) {
      throw AppError.notFound(`Teacher with id '${id}' not found`);
    }
    return teacher;
  }

  static async createTeacher(data) {
    if (data.teacherCode) {
      const existing = await TeacherModel.findByCode(data.teacherCode);
      if (existing) {
        throw AppError.conflict('Teacher code is already assigned');
      }
    }
    return TeacherModel.create(data);
  }

  static async updateTeacher(id, data) {
    if (data.teacherCode) {
      const existing = await TeacherModel.findByCode(data.teacherCode);
      if (existing && existing.id !== id) {
        throw AppError.conflict('Teacher code is already assigned to another teacher');
      }
    }
    const updated = await TeacherModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Teacher with id '${id}' not found`);
    }
    return updated;
  }

  static async assignSubjects(id, assignedSubjectIds) {
    if (!Array.isArray(assignedSubjectIds)) {
      throw AppError.badRequest('assignedSubjectIds must be an array of subject IDs');
    }
    const updated = await TeacherModel.assignSubjects(id, assignedSubjectIds);
    if (!updated) {
      throw AppError.notFound(`Teacher with id '${id}' not found`);
    }
    return updated;
  }

  static async assignClasses(id, assignedClassIds) {
    if (!Array.isArray(assignedClassIds)) {
      throw AppError.badRequest('assignedClassIds must be an array of class IDs');
    }
    const updated = await TeacherModel.assignClasses(id, assignedClassIds);
    if (!updated) {
      throw AppError.notFound(`Teacher with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteTeacher(id) {
    const deleted = await TeacherModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Teacher with id '${id}' not found`);
    }
    return true;
  }
}

export default TeachersService;
