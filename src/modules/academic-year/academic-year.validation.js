const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const academicYearValidation = {
  addNextTerm: (req) => {
    const { plannedStartDate, plannedEndDate } = req.body || {};
    const errors = [];

    if (plannedStartDate !== undefined && plannedStartDate !== null && plannedStartDate !== '') {
      if (!DATE_REGEX.test(plannedStartDate)) {
        errors.push({ field: 'plannedStartDate', message: 'plannedStartDate must be a valid date string (YYYY-MM-DD)' });
      }
    }

    if (plannedEndDate !== undefined && plannedEndDate !== null && plannedEndDate !== '') {
      if (!DATE_REGEX.test(plannedEndDate)) {
        errors.push({ field: 'plannedEndDate', message: 'plannedEndDate must be a valid date string (YYYY-MM-DD)' });
      }
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updatePlannedDates: (req) => {
    const { plannedStartDate, plannedEndDate } = req.body || {};
    const errors = [];

    if (plannedStartDate === undefined && plannedEndDate === undefined) {
      errors.push({ field: 'body', message: 'At least one of plannedStartDate or plannedEndDate must be provided' });
    }

    if (plannedStartDate !== undefined && plannedStartDate !== null && plannedStartDate !== '') {
      if (!DATE_REGEX.test(plannedStartDate)) {
        errors.push({ field: 'plannedStartDate', message: 'plannedStartDate must be a valid date string (YYYY-MM-DD)' });
      }
    }

    if (plannedEndDate !== undefined && plannedEndDate !== null && plannedEndDate !== '') {
      if (!DATE_REGEX.test(plannedEndDate)) {
        errors.push({ field: 'plannedEndDate', message: 'plannedEndDate must be a valid date string (YYYY-MM-DD)' });
      }
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  termIdParam: (req) => {
    const { id } = req.params || {};
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return { message: 'Validation failed', details: [{ field: 'id', message: 'Term ID is required' }] };
    }
    return null;
  },
};

export default academicYearValidation;

