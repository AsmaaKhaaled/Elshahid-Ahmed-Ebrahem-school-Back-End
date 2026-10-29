export const gradesValidation = {
  // Exam schedules validation
  createExam: (req) => {
    const { title, type, subjectId, classId, examDate } = req.body || {};
    const errors = [];

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Exam title is required' });
    }

    const validTypes = ['QUIZ', 'MIDTERM', 'FINAL', 'MONTHLY'];
    if (type && !validTypes.includes(type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (!subjectId) {
      errors.push({ field: 'subjectId', message: 'Subject ID is required' });
    }

    if (!classId) {
      errors.push({ field: 'classId', message: 'Class ID is required' });
    }

    if (!examDate) {
      errors.push({ field: 'examDate', message: 'Exam date is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateExam: (req) => {
    const { title, type } = req.body || {};
    const errors = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      errors.push({ field: 'title', message: 'Exam title cannot be empty' });
    }

    const validTypes = ['QUIZ', 'MIDTERM', 'FINAL', 'MONTHLY'];
    if (type !== undefined && !validTypes.includes(type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  // Marks recording validation
  submitGrade: (req) => {
    const { studentId, examId, score } = req.body || {};
    const errors = [];

    if (!studentId) {
      errors.push({ field: 'studentId', message: 'Student ID is required' });
    }

    if (!examId) {
      errors.push({ field: 'examId', message: 'Exam ID is required' });
    }

    if (score === undefined || isNaN(Number(score)) || Number(score) < 0) {
      errors.push({ field: 'score', message: 'Score must be a valid non-negative number' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  recordBulkMarks: (req) => {
    const { examId, marks } = req.body || {};
    const errors = [];

    if (!examId) {
      errors.push({ field: 'examId', message: 'Exam ID is required' });
    }

    if (!marks || !Array.isArray(marks) || marks.length === 0) {
      errors.push({ field: 'marks', message: 'marks must be a non-empty array of student marks' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateGrade: (req) => {
    const { score } = req.body || {};
    const errors = [];

    if (score !== undefined && (isNaN(Number(score)) || Number(score) < 0)) {
      errors.push({ field: 'score', message: 'Score must be a valid non-negative number' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default gradesValidation;
