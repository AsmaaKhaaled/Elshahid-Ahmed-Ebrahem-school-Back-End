export const attendanceValidation = {
  recordAttendance: (req) => {
    const { studentId, classId, status } = req.body || {};
    const errors = [];

    if (!studentId) {
      errors.push({ field: 'studentId', message: 'Student ID is required' });
    }

    if (!classId) {
      errors.push({ field: 'classId', message: 'Class ID is required' });
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (status && !validStatuses.includes(status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  recordDailyClass: (req) => {
    const { classId, records } = req.body || {};
    const errors = [];

    if (!classId) {
      errors.push({ field: 'classId', message: 'Class ID is required' });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      errors.push({ field: 'records', message: 'records must be a non-empty array of students attendance' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateAttendance: (req) => {
    const { status } = req.body || {};
    const errors = [];

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (status !== undefined && !validStatuses.includes(status.toUpperCase())) {
      errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default attendanceValidation;
