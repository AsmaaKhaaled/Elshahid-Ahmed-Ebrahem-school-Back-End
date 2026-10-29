export const timetableValidation = {
  createEntry: (req) => {
    const { dayOfWeek, periodNumber, startTime, endTime, classId, subjectId } = req.body || {};
    const errors = [];

    const validDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    if (!dayOfWeek || !validDays.includes(dayOfWeek.toUpperCase())) {
      errors.push({ field: 'dayOfWeek', message: `Day of week must be one of: ${validDays.join(', ')}` });
    }

    if (periodNumber === undefined || isNaN(Number(periodNumber))) {
      errors.push({ field: 'periodNumber', message: 'Valid period number is required' });
    }

    if (!startTime || !endTime) {
      errors.push({ field: 'time', message: 'Start time and end time are required' });
    }

    if (!classId) {
      errors.push({ field: 'classId', message: 'Class ID is required' });
    }

    if (!subjectId) {
      errors.push({ field: 'subjectId', message: 'Subject ID is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateEntry: (req) => {
    const { dayOfWeek, periodNumber } = req.body || {};
    const errors = [];

    const validDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    if (dayOfWeek !== undefined && !validDays.includes(dayOfWeek.toUpperCase())) {
      errors.push({ field: 'dayOfWeek', message: `Day of week must be one of: ${validDays.join(', ')}` });
    }

    if (periodNumber !== undefined && isNaN(Number(periodNumber))) {
      errors.push({ field: 'periodNumber', message: 'Period number must be numeric' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default timetableValidation;

