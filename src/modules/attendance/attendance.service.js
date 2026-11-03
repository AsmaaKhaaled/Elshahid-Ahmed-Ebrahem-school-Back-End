import { AttendanceModel } from './attendance.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../config/database.js';

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
    const counts = await prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId },
      _count: {
        _all: true,
      },
    });

    let totalDays = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const group of counts) {
      const count = group._count._all;
      totalDays += count;
      if (group.status === 'PRESENT') presentCount = count;
      else if (group.status === 'ABSENT') absentCount = count;
      else if (group.status === 'LATE') lateCount = count;
      else if (group.status === 'EXCUSED') excusedCount = count;
    }

    const attendedDays = presentCount + lateCount + excusedCount;
    const attendanceRate = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

    return {
      studentId,
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendanceRate,
    };
  }

  static async getClassAttendanceRate(classId, date) {
    const where = { classId };
    if (date) where.date = date;

    const counts = await prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true,
      },
    });

    let totalRecords = 0;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const group of counts) {
      const count = group._count._all;
      totalRecords += count;
      if (group.status === 'PRESENT') presentCount = count;
      else if (group.status === 'ABSENT') absentCount = count;
      else if (group.status === 'LATE') lateCount = count;
      else if (group.status === 'EXCUSED') excusedCount = count;
    }

    const presentRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

    return {
      classId,
      date: date || 'ALL_TIME',
      totalRecords,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
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
