import { isSafeLink } from '../curricula/curricula.validation.js';

export const MAX_SECTIONS = 12;
export const MAX_FILES_PER_MATERIAL = 10;
export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 3000;
export const MAX_SEARCH_LENGTH = 100;
// The text fields of one save: title, description, subject, link, every class and every kept file
export const MAX_FORM_FIELDS = 4 + MAX_SECTIONS + MAX_FILES_PER_MATERIAL;

const SECTION_REGEX = /^[1-3]\/\d{1,2}$/;
const ID_REGEX = /^[a-z0-9]{10,40}$/i;

const result = (errors) => (errors.length ? { message: 'Validation failed', details: errors } : null);

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

// Sent as form fields (the request carries files): one value arrives as a string, several as a list
export const sectionsOf = (body) => [].concat(body?.sections ?? []);

export const keepFileIdsOf = (body) => [].concat(body?.keepFileIds ?? []);

/** The link, or '' when none was sent. */
export const linkOf = (body) => (typeof body?.link === 'string' ? body.link.trim() : '');

export const materialsValidation = {
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
    const { page, limit, search, subject } = req.query || {};
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
    if (subject !== undefined && !isText(subject, 100)) {
      errors.push({ field: 'subject', message: 'Invalid subject' });
    }
    return result(errors);
  },

  /**
   * POST / and PUT /:id (multipart: files)
   * Body: { title, description?, subject, sections: string[], link?, keepFileIds? (PUT: the files to keep) }
   */
  save: (req) => {
    const body = req.body || {};
    const { title, description, subject, link } = body;
    const errors = [];
    if (!isText(title, MAX_TITLE_LENGTH)) {
      errors.push({ field: 'title', message: `title is required (at most ${MAX_TITLE_LENGTH} characters)` });
    }
    if (!isText(subject, 100)) errors.push({ field: 'subject', message: 'subject is required' });
    if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      errors.push({ field: 'description', message: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` });
    }
    const sections = sectionsOf(body);
    if (sections.length === 0 || sections.length > MAX_SECTIONS) {
      errors.push({ field: 'sections', message: `sections must have 1 to ${MAX_SECTIONS} classes` });
    } else if (sections.some((s) => typeof s !== 'string' || !SECTION_REGEX.test(s))) {
      errors.push({ field: 'sections', message: 'Each class must look like "3/2"' });
    }
    if (link !== undefined && link !== null && linkOf(body) !== '' && !isSafeLink(link)) {
      errors.push({ field: 'link', message: 'link must be an http(s) address' });
    }
    if (keepFileIdsOf(body).some((id) => typeof id !== 'string' || !ID_REGEX.test(id))) {
      errors.push({ field: 'keepFileIds', message: 'Invalid keepFileIds' });
    }
    return result(errors);
  },
};

export default materialsValidation;
