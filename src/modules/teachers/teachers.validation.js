export const teachersValidation = {
  createTeacher: (req) => {
    const { fullNameArabic, specialization, phone } = req.body || {};
    const errors = [];

    if (!fullNameArabic || typeof fullNameArabic !== 'string' || fullNameArabic.trim().length < 3) {
      errors.push({ field: 'fullNameArabic', message: 'Full Arabic name is required (min 3 characters)' });
    }

    if (!specialization || typeof specialization !== 'string') {
      errors.push({ field: 'specialization', message: 'Specialization subject is required' });
    }

    if (phone && typeof phone !== 'string') {
      errors.push({ field: 'phone', message: 'Phone must be a valid string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateTeacher: (req) => {
    const { fullNameArabic, specialization } = req.body || {};
    const errors = [];

    if (fullNameArabic !== undefined && (typeof fullNameArabic !== 'string' || fullNameArabic.trim().length < 3)) {
      errors.push({ field: 'fullNameArabic', message: 'Full Arabic name must be at least 3 characters' });
    }

    if (specialization !== undefined && typeof specialization !== 'string') {
      errors.push({ field: 'specialization', message: 'Specialization must be a valid string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  assignSubjects: (req) => {
    const { assignedSubjectIds } = req.body || {};
    if (!assignedSubjectIds || !Array.isArray(assignedSubjectIds)) {
      return {
        message: 'Validation failed',
        details: [{ field: 'assignedSubjectIds', message: 'assignedSubjectIds must be an array' }],
      };
    }
    return null;
  },

  assignClasses: (req) => {
    const { assignedClassIds } = req.body || {};
    if (!assignedClassIds || !Array.isArray(assignedClassIds)) {
      return {
        message: 'Validation failed',
        details: [{ field: 'assignedClassIds', message: 'assignedClassIds must be an array' }],
      };
    }
    return null;
  },
};

export default teachersValidation;
