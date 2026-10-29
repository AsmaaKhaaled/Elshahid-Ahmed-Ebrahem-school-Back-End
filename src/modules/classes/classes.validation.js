export const classesValidation = {
  createClass: (req) => {
    const { name, gradeLevel } = req.body || {};
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Class name is required' });
    }

    if (!gradeLevel || typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateClass: (req) => {
    const { name, gradeLevel } = req.body || {};
    const errors = [];

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      errors.push({ field: 'name', message: 'Class name cannot be empty' });
    }

    if (gradeLevel !== undefined && typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level must be a valid string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default classesValidation;

