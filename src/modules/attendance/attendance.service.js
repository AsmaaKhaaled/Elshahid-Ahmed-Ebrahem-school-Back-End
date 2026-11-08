import { AttendanceModel } from './attendance.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { prisma } from '../../config/database.js';
import { isAdminRole, studentClassIdOf, teachingScopeOf } from '../../shared/utils/teaching-scope.js';
import { doneBy } from '../auth/accounts.js';

// ---- A teacher takes & sees attendance only for their classes (the ones they teach, plus the one they advise).
// ---- A student sees their own. The administration: every class.

const NOT_YOUR_CLASS = 'لا يمكنك تسجيل أو عرض الغياب إلا لفصولك';

const assertOwnClass = async (user, classId) => {
  const scope = await teachingScopeOf(user);
  if (scope && !scope.ownClassIds.has(classId)) throw AppError.forbidden(NOT_YOUR_CLASS);
};

// The students must be enrolled in the class the attendance is taken for
const assertStudentsInClass = async (studentIds, classId) => {
  const ids = [...new Set(studentIds)];
  const inClass = await prisma.student.count({ where: { id: { in: ids }, classId } });
  if (inClass !== ids.length) {
    throw AppError.badRequest('بعض الطلاب ليسوا مقيدين في هذا الفصل');
  }
};

/** Which attendance records the viewer may see, as a Prisma condition. */
const visibleAttendanceWhere = async (user) => {
  if (isAdminRole(user)) return {};
  if (user?.role === 'STUDENT') return { studentId: user.studentProfile?.id ?? '__none__' };
  const scope = await teachingScopeOf(user);
  if (!scope) throw AppError.forbidden('غير مصرح لك بالاطلاع على سجلات الغياب');
  return { classId: { in: [...scope.ownClassIds] } };
};

export class AttendanceService {
  static async getAttendance(query, user) {
    return AttendanceModel.findAll(query, await visibleAttendanceWhere(user));
  }

  static async getAttendanceById(id, user) {
    const visible = await prisma.attendance.findFirst({ where: { id, ...(await visibleAttendanceWhere(user)) }, select: { id: true } });
    const record = visible && (await AttendanceModel.findById(id));
    if (!record) {
      throw AppError.notFound(`Attendance record with id '${id}' not found`);
    }
    return record;
  }

  static async recordAttendance(data, user) {
    if (!data.classId) {
      throw AppError.badRequest('classId is required');
    }
    await assertOwnClass(user, data.classId);
    await assertStudentsInClass([data.studentId], data.classId);
    return AttendanceModel.create(data);
  }

  static async recordDailyClassAttendance({ classId, date, records, recordedBy = {} }, user) {
    if (!classId) {
      throw AppError.badRequest('classId is required');
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw AppError.badRequest('records must be an array of student attendance items');
    }

    await assertOwnClass(user, classId);
    await assertStudentsInClass(records.map((item) => item.studentId), classId);

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    const preparedRecords = records.map((item) => ({
      date: attendanceDate,
      classId,
      studentId: item.studentId,
      status: item.status || 'PRESENT',
      remarks: item.remarks || '',
      ...recordedBy,
    }));

    const result = await AttendanceModel.createMany(preparedRecords);
    return {
      classId,
      date: attendanceDate,
      recordedCount: result.length,
      records: result,
    };
  }

  static async getStudentAttendanceRate(studentId, user) {
    // A teacher: only a student in one of their classes (a student's own rate is checked by the controller)
    const scope = await teachingScopeOf(user);
    if (!scope && !isAdminRole(user) && user?.role !== 'STUDENT') {
      throw AppError.forbidden('غير مصرح لك بالاطلاع على سجلات الغياب');
    }
    if (scope) {
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
      if (!student?.classId || !scope.ownClassIds.has(student.classId)) throw AppError.forbidden(NOT_YOUR_CLASS);
    }

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

  static async getClassAttendanceRate(classId, date, user) {
    // A teacher: one of their classes; a student: their own class
    if (user?.role === 'STUDENT') {
      if (studentClassIdOf(user) !== classId) throw AppError.forbidden('غير مصرح لك بالاطلاع على حضور فصل آخر');
    } else if (!isAdminRole(user)) {
      const scope = await teachingScopeOf(user);
      if (!scope) throw AppError.forbidden('غير مصرح لك بالاطلاع على سجلات الغياب');
      if (!scope.ownClassIds.has(classId)) throw AppError.forbidden(NOT_YOUR_CLASS);
    }

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

  static async updateAttendance(id, data, user) {
    const record = await prisma.attendance.findUnique({ where: { id }, select: { classId: true } });
    if (!record) {
      throw AppError.notFound(`Attendance record with id '${id}' not found`);
    }
    await assertOwnClass(user, record.classId);
    // Only the status & remarks change: the student, class and date stay as recorded
    const updated = await AttendanceModel.update(id, {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.remarks !== undefined && { remarks: data.remarks }),
      ...doneBy(user, 'recordedById', 'recordedByTeacherId'),
    });
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
