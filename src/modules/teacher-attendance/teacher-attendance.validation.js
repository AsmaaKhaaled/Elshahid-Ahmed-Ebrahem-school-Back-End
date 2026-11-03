export const TEACHER_ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'CASUAL_LEAVE', 'SICK_LEAVE', 'MISSION'];
// Statuses the archive can be filtered by (includes the one the system fills in)
export const ARCHIVE_STATUSES = [...TEACHER_ATTENDANCE_STATUSES, 'NOT_RECORDED'];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NOTE_LENGTH = 300;
const MAX_REASON_LENGTH = 150;
// Longest single holiday entry (e.g. the mid-year break)
export const MAX_HOLIDAY_DAYS = 60;

export const isValidDate = (value) => {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const result = (errors) => (errors.length ? { message: 'Validation failed', details: errors } : null);

const checkOptionalTime = (value, field, errors) => {
  if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || !TIME_REGEX.test(value))) {
    errors.push({ field, message: `${field} must be a time in HH:mm format` });
  }
};

export const teacherAttendanceValidation = {
  dateParam: (req) => (isValidDate(req.params.date) ? null : { message: 'Date must be in YYYY-MM-DD format' }),

  /**
   * PUT /day/:date
   * Body: { records: [{ teacherId, status, arrivalTime?, departureTime?, note? }] }
   */
  saveDay: (req) => {
    const errors = [];
    if (!isValidDate(req.params.date)) {
      errors.push({ field: 'date', message: 'Date must be in YYYY-MM-DD format' });
    }

    const { records } = req.body || {};
    if (!Array.isArray(records) || records.length === 0) {
      errors.push({ field: 'records', message: 'records must be a non-empty array' });
      return result(errors);
    }

    const seen = new Set();
    records.forEach((record, index) => {
      const prefix = `records[${index}]`;
      if (!record || typeof record.teacherId !== 'string' || !record.teacherId) {
        errors.push({ field: `${prefix}.teacherId`, message: 'teacherId is required' });
      } else if (seen.has(record.teacherId)) {
        errors.push({ field: `${prefix}.teacherId`, message: 'Each teacher can appear only once' });
      } else {
        seen.add(record.teacherId);
      }
      if (!TEACHER_ATTENDANCE_STATUSES.includes(record?.status)) {
        errors.push({ field: `${prefix}.status`, message: `status must be one of: ${TEACHER_ATTENDANCE_STATUSES.join(', ')}` });
      }
      checkOptionalTime(record?.arrivalTime, `${prefix}.arrivalTime`, errors);
      checkOptionalTime(record?.departureTime, `${prefix}.departureTime`, errors);
      if (record?.note !== undefined && record?.note !== null && (typeof record.note !== 'string' || record.note.length > MAX_NOTE_LENGTH)) {
        errors.push({ field: `${prefix}.note`, message: `note must be text up to ${MAX_NOTE_LENGTH} characters` });
      }
    });
    return result(errors);
  },

  /**
   * GET /records & /export
   * Query: { from?, to?, teacherId?, status?, page?, limit?, pageSize? (old name for limit) }
   */
  archiveQuery: (req) => {
    const { from, to, status, page, limit, pageSize } = req.query || {};
    const errors = [];
    if (from !== undefined && !isValidDate(from)) errors.push({ field: 'from', message: 'from must be YYYY-MM-DD' });
    if (to !== undefined && !isValidDate(to)) errors.push({ field: 'to', message: 'to must be YYYY-MM-DD' });
    if (isValidDate(from) && isValidDate(to) && from > to) errors.push({ field: 'from', message: 'from must be before to' });
    if (status !== undefined && !ARCHIVE_STATUSES.includes(status)) {
      errors.push({ field: 'status', message: `status must be one of: ${ARCHIVE_STATUSES.join(', ')}` });
    }
    if (page !== undefined && !(Number.isInteger(Number(page)) && Number(page) >= 1)) {
      errors.push({ field: 'page', message: 'page must be a positive integer' });
    }
    const isPageSize = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100;
    if (limit !== undefined && !isPageSize(limit)) {
      errors.push({ field: 'limit', message: 'limit must be between 1 and 100' });
    }
    if (pageSize !== undefined && !isPageSize(pageSize)) {
      errors.push({ field: 'pageSize', message: 'pageSize must be between 1 and 100' });
    }
    return result(errors);
  },

  /**
   * POST /holidays
   * Body: { startDate, endDate?, reason }
   */
  createHoliday: (req) => {
    const { startDate, endDate, reason } = req.body || {};
    const errors = [];
    if (!isValidDate(startDate)) errors.push({ field: 'startDate', message: 'startDate must be YYYY-MM-DD' });
    if (endDate !== undefined && endDate !== null && endDate !== '' && !isValidDate(endDate)) {
      errors.push({ field: 'endDate', message: 'endDate must be YYYY-MM-DD' });
    }
    if (isValidDate(startDate) && isValidDate(endDate) && startDate > endDate) {
      errors.push({ field: 'endDate', message: 'endDate must be on or after startDate' });
    }
    if (typeof reason !== 'string' || reason.trim().length < 2 || reason.trim().length > MAX_REASON_LENGTH) {
      errors.push({ field: 'reason', message: `reason must be 2-${MAX_REASON_LENGTH} characters` });
    }
    return result(errors);
  },
};

export default teacherAttendanceValidation;
