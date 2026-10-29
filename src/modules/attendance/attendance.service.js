import { AttendanceModel } from './attendance.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AttendanceService {
  static async getAttendance(query) {
    return AttendanceModel.findAll(query);
  }

  static async getAttendanceById(id) {
    const record = await AttendanceModel.findById(id);
    if (!record) {
      throw AppError.notFound(`Attendance record with id '${id}' not found`);
    }
    return record;
  }

  static async recordAttendance(data) {
    return AttendanceModel.create(data);
  }

  static async recordDailyClassAttendance({ classId, date, records, recordedById }) {
    if (!classId) {
      throw AppError.badRequest('classId is required');
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw AppError.badRequest('records must be an array of student attendance items');
    }

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    const preparedRecords = records.map((item) => ({
      date: attendanceDate,
      classId,
      studentId: item.studentId,
      status: item.status || 'PRESENT',
      remarks: item.remarks || '',
      recordedById,
    }));

    const result = await AttendanceModel.createMany(preparedRecords);
    return {
      classId,
      date: attendanceDate,
      recordedCount: result.length,
      records: result,
    };
  }

  static async getStudentAttendanceRate(studentId) {
    const records = await AttendanceModel.findAll({ studentId });
    const totalDays = records.length;

    if (totalDays === 0) {
      return {
        studentId,
        totalDays: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        attendanceRate: 0,
      };
    }

    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const excusedCount = records.filter((r) => r.status === 'EXCUSED').length;

    // Rate: (present + late + excused) / totalDays
    const attendedDays = presentCount + lateCount + excusedCount;
    const attendanceRate = Math.round((attendedDays / totalDays) * 100);

    return {
      studentId,
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendanceRate, // Percentage
    };
  }

  static async getClassAttendanceRate(classId, date) {
    const query = { classId };
    if (date) query.date = date;

    const records = await AttendanceModel.findAll(query);
    const totalRecords = records.length;

    if (totalRecords === 0) {
      return {
        classId,
        date: date || 'ALL_TIME',
        totalRecords: 0,
        presentRate: 0,
      };
    }

    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const presentRate = Math.round((presentCount / totalRecords) * 100);

    return {
      classId,
      date: date || 'ALL_TIME',
      totalRecords,
      presentCount,
      absentCount: records.filter((r) => r.status === 'ABSENT').length,
      lateCount: records.filter((r) => r.status === 'LATE').length,
      presentRate,
    };
  }

  static async updateAttendance(id, data) {
    const updated = await AttendanceModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Attendance record with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteAttendance(id) {
    const deleted = await AttendanceModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Attendance record with id '${id}' not found`);
    }
    return true;
  }
}

export default AttendanceService;
