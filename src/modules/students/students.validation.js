export const studentsValidation = {
  createStudent: (req) => {
    const { fullNameArabic, gender, guardianPhone } = req.body || {};
    const errors = [];

    if (!fullNameArabic || typeof fullNameArabic !== 'string' || fullNameArabic.trim().length < 3) {
      errors.push({ field: 'fullNameArabic', message: 'Full Arabic name is required (min 3 characters)' });
    }

    if (gender && !['MALE', 'FEMALE'].includes(gender)) {
      errors.push({ field: 'gender', message: "Gender must be 'MALE' or 'FEMALE'" });
    }

    if (guardianPhone && typeof guardianPhone !== 'string') {
      errors.push({ field: 'guardianPhone', message: 'Guardian phone must be a valid string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateStudent: (req) => {
    const { fullNameArabic, gender } = req.body || {};
    const errors = [];

    if (fullNameArabic !== undefined && (typeof fullNameArabic !== 'string' || fullNameArabic.trim().length < 3)) {
      errors.push({ field: 'fullNameArabic', message: 'Full Arabic name must be at least 3 characters' });
    }

    if (gender !== undefined && !['MALE', 'FEMALE'].includes(gender)) {
      errors.push({ field: 'gender', message: "Gender must be 'MALE' or 'FEMALE'" });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  enroll: (req) => {
    const { classId } = req.body || {};
    if (!classId || typeof classId !== 'string') {
      return {
        message: 'Validation failed',
        details: [{ field: 'classId', message: 'Target classId is required for enrollment' }],
      };
    }
    return null;
  },

  bulkImport: (req) => {
    const { students } = req.body || {};
    if (!students || !Array.isArray(students) || students.length === 0) {
      return {
        message: 'Validation failed',
        details: [{ field: 'students', message: 'An array of student records is required in body.students' }],
      };
    }
    return null;
  },
};

export default studentsValidation;
