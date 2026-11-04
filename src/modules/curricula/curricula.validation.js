export const CURRICULUM_FILE_KINDS = ['BOOK', 'PLAN', 'EXAMS', 'GUIDE', 'OTHER'];
export const GRADE_IDS = ['G1', 'G2', 'G3'];

// Upper bounds so one request (or one teacher) can't grow without limit
export const MAX_SECTIONS = 12;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 150;
export const MAX_LINK_LENGTH = 500;
export const MAX_PLAN_WEEKS = 60;
export const MAX_OBJECTIVES_PER_WEEK = 20;
export const MAX_PLAN_TEXT_LENGTH = 300;
export const MAX_SEARCH_LENGTH = 100;

const SECTION_REGEX = /^[1-3]\/\d{1,2}$/;
const ID_REGEX = /^[a-z0-9]{10,40}$/i;

const result = (errors) => (errors.length ? { message: 'Validation failed', details: errors } : null);

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

const checkPaging = (query, errors) => {
  const { page, limit } = query;
  if (page !== undefined && !(Number.isInteger(Number(page)) && Number(page) >= 1)) {
    errors.push({ field: 'page', message: 'page must be a positive integer' });
  }
  if (limit !== undefined && !(Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= 100)) {
    errors.push({ field: 'limit', message: 'limit must be between 1 and 100' });
  }
};

/** http(s) links only (no javascript: or data: URLs) */
export const isSafeLink = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LINK_LENGTH) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const curriculaValidation = {
  idParam: (req) => {
    const { id, fileId } = req.params;
    if (!ID_REGEX.test(id) || (fileId !== undefined && !ID_REGEX.test(fileId))) {
      return { message: 'Invalid id' };
    }
    return null;
  },

  /**
   * GET /
   * Query: { page?, limit?, search?, gradeId?, subject?, teacherId? }
   */
  listQuery: (req) => {
    const query = req.query || {};
    const errors = [];
    checkPaging(query, errors);
    if (query.search !== undefined && String(query.search).length > MAX_SEARCH_LENGTH) {
      errors.push({ field: 'search', message: `search must be at most ${MAX_SEARCH_LENGTH} characters` });
    }
    if (query.gradeId !== undefined && !GRADE_IDS.includes(query.gradeId)) {
      errors.push({ field: 'gradeId', message: `gradeId must be one of: ${GRADE_IDS.join(', ')}` });
    }
    if (query.teacherId !== undefined && !ID_REGEX.test(String(query.teacherId))) {
      errors.push({ field: 'teacherId', message: 'Invalid teacherId' });
    }
    return result(errors);
  },

  /**
   * GET /:id/files
   * Query: { page?, limit?, kind? }
   */
  filesQuery: (req) => {
    const query = req.query || {};
    const errors = [];
    checkPaging(query, errors);
    if (query.kind !== undefined && !CURRICULUM_FILE_KINDS.includes(query.kind)) {
      errors.push({ field: 'kind', message: `kind must be one of: ${CURRICULUM_FILE_KINDS.join(', ')}` });
    }
    return result(errors);
  },

  /**
   * POST / and PUT /:id
   * Body: { subject, gradeId, sections: string[], description? }
   */
  saveCurriculum: (req) => {
    const { subject, gradeId, sections, description } = req.body || {};
    const errors = [];
    if (!isText(subject, 100)) errors.push({ field: 'subject', message: 'subject is required' });
    if (!GRADE_IDS.includes(gradeId)) {
      errors.push({ field: 'gradeId', message: `gradeId must be one of: ${GRADE_IDS.join(', ')}` });
    }
    if (!Array.isArray(sections) || sections.length === 0 || sections.length > MAX_SECTIONS) {
      errors.push({ field: 'sections', message: `sections must have 1 to ${MAX_SECTIONS} classes` });
    } else if (sections.some((s) => typeof s !== 'string' || !SECTION_REGEX.test(s))) {
      errors.push({ field: 'sections', message: 'Each class must look like "3/2"' });
    } else if (GRADE_IDS.includes(gradeId) && sections.some((s) => s[0] !== gradeId[1])) {
      errors.push({ field: 'sections', message: 'Every class must be in the chosen grade' });
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      errors.push({ field: 'description', message: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
    }
    return result(errors);
  },

  /**
   * POST /:id/files (multipart: file, or a link)
   * Body: { kind, title, forStudents?, link? }
   */
  addFile: (req) => {
    const { kind, title, link } = req.body || {};
    const errors = [];
    if (!CURRICULUM_FILE_KINDS.includes(kind)) {
      errors.push({ field: 'kind', message: `kind must be one of: ${CURRICULUM_FILE_KINDS.join(', ')}` });
    }
    if (!isText(title, MAX_TITLE_LENGTH)) {
      errors.push({ field: 'title', message: `title is required (at most ${MAX_TITLE_LENGTH} characters)` });
    }
    const hasLink = typeof link === 'string' && link.trim() !== '';
    if (!req.file && !hasLink) errors.push({ field: 'file', message: 'Upload a file or add a link' });
    if (req.file && hasLink) errors.push({ field: 'link', message: 'Send a file or a link, not both' });
    if (hasLink && !isSafeLink(link)) errors.push({ field: 'link', message: 'link must be an http(s) address' });
    return result(errors);
  },

  /**
   * PUT /:id/plan
   * Body: { weeks: [{ topic, objectives: string[] }] } (in order: week 1, 2, 3...)
   */
  savePlan: (req) => {
    const { weeks } = req.body || {};
    const errors = [];
    if (!Array.isArray(weeks) || weeks.length > MAX_PLAN_WEEKS) {
      errors.push({ field: 'weeks', message: `weeks must be a list of at most ${MAX_PLAN_WEEKS}` });
      return result(errors);
    }
    weeks.forEach((week, i) => {
      if (!isText(week?.topic, MAX_PLAN_TEXT_LENGTH)) {
        errors.push({ field: `weeks[${i}].topic`, message: 'topic is required' });
      }
      const objectives = week?.objectives ?? [];
      if (
        !Array.isArray(objectives) ||
        objectives.length > MAX_OBJECTIVES_PER_WEEK ||
        objectives.some((o) => !isText(o, MAX_PLAN_TEXT_LENGTH))
      ) {
        errors.push({ field: `weeks[${i}].objectives`, message: `objectives: at most ${MAX_OBJECTIVES_PER_WEEK} short lines` });
      }
    });
    return result(errors);
  },
};

export default curriculaValidation;
