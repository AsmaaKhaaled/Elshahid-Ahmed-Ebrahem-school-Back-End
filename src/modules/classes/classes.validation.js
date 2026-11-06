import { GRADES } from '../teachers/teachers.service.js';
import { MAX_CLASS_CAPACITY, MAX_SECTIONS_PER_GRADE } from './classes.service.js';

const isIntBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export const classesValidation = {
  /** { grades: [{ grade: 1, sections: 4, capacity: 45 }, ...] } - one entry per grade */
  saveStructure: (req) => {
    const { grades } = req.body || {};
    const errors = [];
    const numbers = GRADES.map((g) => g.number);

    if (!Array.isArray(grades) || grades.length !== numbers.length || numbers.some((n) => !grades.some((g) => g?.grade === n))) {
      errors.push({ field: 'grades', message: `grades must have one entry for each grade: ${numbers.join(', ')}` });
    } else {
      grades.forEach((g, i) => {
        if (!isIntBetween(g.sections, 1, MAX_SECTIONS_PER_GRADE)) {
          errors.push({ field: `grades[${i}].sections`, message: `sections must be 1-${MAX_SECTIONS_PER_GRADE}` });
        }
        if (!isIntBetween(g.capacity, 1, MAX_CLASS_CAPACITY)) {
          errors.push({ field: `grades[${i}].capacity`, message: `capacity must be 1-${MAX_CLASS_CAPACITY}` });
        }
      });
    }

    return errors.length ? { message: 'Validation failed', details: errors } : null;
  },

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

