export const materialsValidation = {
  createMaterial: (req) => {
    const { title, type, subjectId, fileUrl } = req.body || {};
    const errors = [];

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Material title is required' });
    }

    const validTypes = ['SYLLABUS_PDF', 'MONTHLY_PLAN', 'WORKSHEET', 'REFERENCE'];
    if (type && !validTypes.includes(type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (!subjectId) {
      errors.push({ field: 'subjectId', message: 'Subject ID is required' });
    }

    if (!fileUrl || typeof fileUrl !== 'string') {
      errors.push({ field: 'fileUrl', message: 'File URL / path is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateMaterial: (req) => {
    const { title, type } = req.body || {};
    const errors = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      errors.push({ field: 'title', message: 'Material title cannot be empty' });
    }

    const validTypes = ['SYLLABUS_PDF', 'MONTHLY_PLAN', 'WORKSHEET', 'REFERENCE'];
    if (type !== undefined && !validTypes.includes(type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default materialsValidation;

