import { GRADES } from '../teachers/teachers.service.js';
import { MAX_CLASS_CAPACITY, MAX_SECTIONS_PER_GRADE } from './classes.service.js';

const isIntBetween = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export const classesValidation = {
  /** { grades: [{ grade: 1, sections: 4, capacity: 40 }, ...] } - one entry per grade */
  saveStructure: (req) => {
    const { grades } = req.body || {};
    const errors = [];
    const numbers = GRADES.map((g) => g.number);

    if (!Array.isArray(grades) || grades.length !== numbers.length || numbers.some((n) => !grades.some((g) => g?.grade === n))) {
      errors.push({ field: 'grades', message: `grades must have one entry for each grade: ${numbers.join(', ')}` });
    } else {
      grades.forEach((g, i) => {
        if (!isIntBetween(g.sections, 1, MAX_SECTIONS_PER_GRADE)) {
          errors.push({ field: `grades[${i}].sections`, message: `عدد الفصول يجب أن يكون بين 1 و ${MAX_SECTIONS_PER_GRADE}` });
        }
        if (!isIntBetween(g.capacity, 20, MAX_CLASS_CAPACITY)) {
          errors.push({ field: `grades[${i}].capacity`, message: `سعة الفصل يجب أن تكون بين 20 و ${MAX_CLASS_CAPACITY} طالباً` });
        }
      });
    }

    return errors.length ? { message: 'Validation failed', details: errors } : null;
  },

  createClass: (req) => {
    const { name, gradeLevel, capacity } = req.body || {};
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Class name is required' });
    }

    if (!gradeLevel || typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level is required' });
    }

    if (capacity !== undefined && !isIntBetween(Number(capacity), 20, MAX_CLASS_CAPACITY)) {
      errors.push({ field: 'capacity', message: `Capacity must be between 20 and ${MAX_CLASS_CAPACITY}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateClass: (req) => {
    const { name, gradeLevel, capacity } = req.body || {};
    const errors = [];

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      errors.push({ field: 'name', message: 'Class name cannot be empty' });
    }

    if (gradeLevel !== undefined && typeof gradeLevel !== 'string') {
      errors.push({ field: 'gradeLevel', message: 'Grade level must be a valid string' });
    }

    if (capacity !== undefined && !isIntBetween(Number(capacity), 20, MAX_CLASS_CAPACITY)) {
      errors.push({ field: 'capacity', message: `Capacity must be between 20 and ${MAX_CLASS_CAPACITY}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  assignAdvisor: (req) => {
    const { teacherId, year, since, reason, note } = req.body || {};
    const errors = [];

    if (teacherId !== undefined && teacherId !== null) {
      if (typeof teacherId !== 'string' || teacherId.trim().length === 0) {
        errors.push({ field: 'teacherId', message: 'teacherId must be a valid ID string or null' });
      }
    }

    if (year !== undefined && year !== null && typeof year !== 'string') {
      errors.push({ field: 'year', message: 'year must be a string' });
    }

    if (since !== undefined && since !== null && typeof since !== 'string') {
      errors.push({ field: 'since', message: 'since must be a string (YYYY-MM-DD)' });
    }

    if (reason !== undefined && reason !== null && typeof reason !== 'string') {
      errors.push({ field: 'reason', message: 'reason must be a string' });
    }

    if (note !== undefined && note !== null && typeof note !== 'string') {
      errors.push({ field: 'note', message: 'note must be a string' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default classesValidation;
