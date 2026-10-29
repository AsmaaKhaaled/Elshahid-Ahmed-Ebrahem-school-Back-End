import { StudentModel } from './students.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class StudentsService {
  static async getStudents(query) {
    return StudentModel.findAll(query);
  }

  static async getStudentById(id) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`Student with id '${id}' not found`);
    }
    return student;
  }

  static async createStudent(data) {
    if (data.studentCode) {
      const existing = await StudentModel.findByCode(data.studentCode);
      if (existing) {
        throw AppError.conflict('Student code is already assigned');
      }
    }
    return StudentModel.create(data);
  }

  static async updateStudent(id, data) {
    if (data.studentCode) {
      const existing = await StudentModel.findByCode(data.studentCode);
      if (existing && existing.id !== id) {
        throw AppError.conflict('Student code is already assigned to another student');
      }
    }
    const updated = await StudentModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Student with id '${id}' not found`);
    }
    return updated;
  }

  static async enrollStudent(id, classId) {
    const updated = await StudentModel.enrollInClass(id, classId);
    if (!updated) {
      throw AppError.notFound(`Student with id '${id}' not found`);
    }
    return updated;
  }

  static async bulkImportStudents(studentsList) {
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      throw AppError.badRequest('Import data must be a non-empty array of student records');
    }

    const validRecords = [];
    const errors = [];

    studentsList.forEach((row, index) => {
      if (!row.fullNameArabic || typeof row.fullNameArabic !== 'string') {
        errors.push({ row: index + 1, error: 'Missing or invalid Arabic full name' });
      } else {
        validRecords.push(row);
      }
    });

    if (validRecords.length === 0) {
      throw AppError.unprocessableEntity('No valid student records found to import', errors);
    }

    const importedStudents = await StudentModel.createMany(validRecords);

    return {
      totalRows: studentsList.length,
      importedCount: importedStudents.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      students: importedStudents,
    };
  }

  static async generateStudentCard(id) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`Student with id '${id}' not found`);
    }

    return {
      cardId: `CARD-${student.studentCode}`,
      schoolName: 'مدرسة الشهيد أحمد إبراهيم للتعليم الأساسي - سلوا',
      schoolAdministration: 'إدارة كوم أمبو التعليمية - محافظة أسوان',
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullNameArabic: student.fullNameArabic,
        fullNameEnglish: student.fullNameEnglish,
        nationalId: student.nationalId,
        gender: student.gender,
        classId: student.classId,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
      },
      barcodeValue: student.studentCode,
      qrData: JSON.stringify({
        code: student.studentCode,
        name: student.fullNameArabic,
        classId: student.classId,
      }),
      issuedAt: new Date().toISOString(),
      expiresAt: `${new Date().getFullYear() + 1}-06-30`,
    };
  }

  static async deleteStudent(id) {
    const deleted = await StudentModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Student with id '${id}' not found`);
    }
    return true;
  }
}

export default StudentsService;
