import { SCHOOL_SUBJECT_NAMES, isSchoolSubject } from '../../shared/constants/school-subjects.js';

const SUBJECT_NAME_MESSAGE = `nameArabic must be one of the school's subjects: ${SCHOOL_SUBJECT_NAMES.join(', ')}`;

export const subjectsValidation = {
  createSubject: (req) => {
    const { code, nameArabic, gradeLevel } = req.body || {};
    const errors = [];

    if (!code || typeof code !== 'string') {
      errors.push({ field: 'code', message: 'Subject code is required' });
    }

    if (!nameArabic || typeof nameArabic !== 'string') {
      errors.push({ field: 'nameArabic', message: 'Subject Arabic name is required' });
    } else if (!isSchoolSubject(nameArabic)) {
      errors.push({ field: 'nameArabic', message: SUBJECT_NAME_MESSAGE });
    }

    if (!gradeLevel || typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateSubject: (req) => {
    const { nameArabic, gradeLevel } = req.body || {};
    const errors = [];

    if (nameArabic !== undefined && !isSchoolSubject(nameArabic)) {
      errors.push({ field: 'nameArabic', message: SUBJECT_NAME_MESSAGE });
    }

    if (gradeLevel !== undefined && typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level must be a string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default subjectsValidation;

