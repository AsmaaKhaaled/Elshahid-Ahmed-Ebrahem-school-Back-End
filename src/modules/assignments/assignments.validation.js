export const MAX_SECTIONS = 12;
export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 3000;
export const MAX_FEEDBACK_LENGTH = 1000;
export const MAX_SEARCH_LENGTH = 100;
export const MIN_SCORE = 1;
export const MAX_SCORE = 100;

const SECTION_REGEX = /^[1-3]\/\d{1,2}$/;
const ID_REGEX = /^[a-z0-9]{10,40}$/i;

const result = (errors) => (errors.length ? { message: 'Validation failed', details: errors } : null);

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

/** Sent as a form field: one value arrives as a string, several as a list. */
export const alsoForIds = (body) => [].concat(body?.alsoFor ?? []);

export const keepFileIdsOf = (body) => [].concat(body?.keepFileIds ?? []);

/** What creating and editing share. */
const checkFields = ({ title, description, subject, dueDate, maxScore, requiresSubmission }, errors) => {
  if (requiresSubmission !== undefined && typeof requiresSubmission !== 'boolean') {
    errors.push({ field: 'requiresSubmission', message: 'requiresSubmission must be true or false' });
  }
  if (!isText(title, MAX_TITLE_LENGTH)) {
    errors.push({ field: 'title', message: `title is required (at most ${MAX_TITLE_LENGTH} characters)` });
  }
  if (!isText(subject, 100)) errors.push({ field: 'subject', message: 'subject is required' });
  if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
    errors.push({ field: 'description', message: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
  }
  if (typeof dueDate !== 'string' || Number.isNaN(Date.parse(dueDate))) {
    errors.push({ field: 'dueDate', message: 'dueDate must be a valid date' });
  }
  if (maxScore !== undefined && !(typeof maxScore === 'number' && maxScore >= MIN_SCORE && maxScore <= MAX_SCORE)) {
    errors.push({ field: 'maxScore', message: `maxScore must be between ${MIN_SCORE} and ${MAX_SCORE}` });
  }
};

export const assignmentsValidation = {
  idParam: (req) => {
    const { id, ...others } = req.params;
    if (!ID_REGEX.test(id) || Object.values(others).some((value) => !ID_REGEX.test(value))) {
      return { message: 'Invalid id' };
    }
    return null;
  },

  /**
   * GET /
   * Query: { page?, limit?, search?, subject? }
   */
  listQuery: (req) => {
    const { page, limit, search } = req.query || {};
    const errors = [];
    if (page !== undefined && !(Number.isInteger(Number(page)) && Number(page) >= 1)) {
      errors.push({ field: 'page', message: 'page must be a positive integer' });
    }
    if (limit !== undefined && !(Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= 100)) {
      errors.push({ field: 'limit', message: 'limit must be between 1 and 100' });
    }
    if (search !== undefined && String(search).length > MAX_SEARCH_LENGTH) {
      errors.push({ field: 'search', message: `search must be at most ${MAX_SEARCH_LENGTH} characters` });
    }
    return result(errors);
  },

  /**
   * POST /
   * Body: { title, description?, subject, sections: string[], dueDate, maxScore? }
   */
  create: (req) => {
    const body = req.body || {};
    const errors = [];
    checkFields(body, errors);
    const { sections, dueDate } = body;
    if (!Array.isArray(sections) || sections.length === 0 || sections.length > MAX_SECTIONS) {
      errors.push({ field: 'sections', message: `sections must have 1 to ${MAX_SECTIONS} classes` });
    } else if (sections.some((s) => typeof s !== 'string' || !SECTION_REGEX.test(s))) {
      errors.push({ field: 'sections', message: 'Each class must look like "3/2"' });
    }
    if (typeof dueDate === 'string' && Date.parse(dueDate) <= Date.now()) {
      errors.push({ field: 'dueDate', message: 'dueDate must be in the future' });
    }
    return result(errors);
  },

  /**
   * PUT /:id
   * Body: { title, description?, subject, dueDate, maxScore? } (the class stays the same)
   */
  update: (req) => {
    const errors = [];
    checkFields(req.body || {}, errors);
    return result(errors);
  },

  /**
   * POST /:id/attachments (multipart: file)
   * Body: { alsoFor? } the ids of the same assignment in the teacher's other classes
   */
  addAttachment: (req) => {
    const errors = [];
    if (!req.file) errors.push({ field: 'file', message: 'Upload a file' });
    const alsoFor = alsoForIds(req.body);
    if (alsoFor.length >= MAX_SECTIONS || alsoFor.some((id) => typeof id !== 'string' || !ID_REGEX.test(id))) {
      errors.push({ field: 'alsoFor', message: 'Invalid alsoFor' });
    }
    return result(errors);
  },

  /**
   * POST /:id/submission (multipart: files, note?, keepFileIds?)
   */
  submit: (req) => {
    const errors = [];
    const { note } = req.body || {};
    if (note !== undefined && (typeof note !== 'string' || note.length > MAX_DESCRIPTION_LENGTH)) {
      errors.push({ field: 'note', message: `note must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
    }
    if (keepFileIdsOf(req.body).some((id) => typeof id !== 'string' || !ID_REGEX.test(id))) {
      errors.push({ field: 'keepFileIds', message: 'Invalid keepFileIds' });
    }
    return result(errors);
  },

  /**
   * PUT /:id/submissions/:submissionId/grade
   * Body: { score, feedback? }
   */
  grade: (req) => {
    const errors = [];
    const { score, feedback } = req.body || {};
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      errors.push({ field: 'score', message: 'score must be a number, 0 or more' });
    }
    if (feedback !== undefined && (typeof feedback !== 'string' || feedback.length > MAX_FEEDBACK_LENGTH)) {
      errors.push({ field: 'feedback', message: `feedback must be at most ${MAX_FEEDBACK_LENGTH} characters` });
    }
    return result(errors);
  },
};

export default assignmentsValidation;
