import { GradeModel } from './grades.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class GradesService {
  // --- Exam Schedules ---
  static async getExams(query) {
    return GradeModel.findAllExams(query);
  }

  static async getExamById(id) {
    const exam = await GradeModel.findExamById(id);
    if (!exam) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return exam;
  }

  static async createExam(data) {
    return GradeModel.createExam(data);
  }

  static async updateExam(id, data) {
    const updated = await GradeModel.updateExam(id, data);
    if (!updated) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteExam(id) {
    const deleted = await GradeModel.deleteExam(id);
    if (!deleted) {
      throw AppError.notFound(`Exam with id '${id}' not found`);
    }
    return true;
  }

  // --- Manual Marks Recording ---
  static async getGrades(query) {
    return GradeModel.findAllGrades(query);
  }

  static async getGradeById(id) {
    const grade = await GradeModel.findGradeById(id);
    if (!grade) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return grade;
  }

  static async submitGrade(data) {
    return GradeModel.createGrade(data);
  }

  static async recordBulkMarks({ examId, subjectId, marks, recordedById }) {
    if (!examId) {
      throw AppError.badRequest('examId is required for recording marks');
    }

    if (!Array.isArray(marks) || marks.length === 0) {
      throw AppError.badRequest('marks must be a non-empty array of student marks');
    }

    const exam = await GradeModel.findExamById(examId);
    const resolvedSubjectId = subjectId || (exam ? exam.subjectId : null);
    const resolvedMaxScore = exam ? exam.maxScore : 100;

    const preparedMarks = marks.map((item) => ({
      studentId: item.studentId,
      examId,
      subjectId: resolvedSubjectId,
      score: item.score,
      maxScore: item.maxScore || resolvedMaxScore,
      remarks: item.remarks || '',
    }));

    const result = await GradeModel.recordBulkMarks(preparedMarks, recordedById);
    return {
      examId,
      recordedCount: result.length,
      marks: result,
    };
  }

  static async getStudentReportCard(studentId) {
    const studentGrades = await GradeModel.findAllGrades({ studentId });

    if (studentGrades.length === 0) {
      return {
        studentId,
        totalExamsTaken: 0,
        averagePercentage: 0,
        overallGrade: 'N/A',
        subjects: [],
      };
    }

    const totalPercentage = studentGrades.reduce((sum, g) => sum + g.percentage, 0);
    const averagePercentage = Math.round(totalPercentage / studentGrades.length);

    let overallGrade = 'F';
    if (averagePercentage >= 95) overallGrade = 'A+';
    else if (averagePercentage >= 85) overallGrade = 'A';
    else if (averagePercentage >= 75) overallGrade = 'B';
    else if (averagePercentage >= 65) overallGrade = 'C';
    else if (averagePercentage >= 50) overallGrade = 'D';

    return {
      studentId,
      totalExamsTaken: studentGrades.length,
      averagePercentage,
      overallGrade,
      grades: studentGrades,
    };
  }

  static async updateGrade(id, data) {
    const updated = await GradeModel.updateGrade(id, data);
    if (!updated) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteGrade(id) {
    const deleted = await GradeModel.deleteGrade(id);
    if (!deleted) {
      throw AppError.notFound(`Grade with id '${id}' not found`);
    }
    return true;
  }
}

export default GradesService;
