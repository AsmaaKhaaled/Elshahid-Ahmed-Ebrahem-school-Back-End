export const EMPLOYMENT_STATUSES = ['ON_DUTY', 'ON_LEAVE', 'SECONDED'];

const NATIONAL_ID_REGEX = /^\d{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EGYPT_MOBILE_REGEX = /^01[0125]\d{8}$/;
// Same rule as admin accounts: at least 8 characters with letters and digits
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters and contain letters and numbers';
const MAX_CLASSES = 20;

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());

// [{ subject: 'اللغة العربية', classes: ['1/1', '2/3'] }, ...]
const isAssignmentList = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => item && typeof item.subject === 'string' && item.subject.trim() && isStringArray(item.classes));

/**
 * Teacher body: { fullName, nationalId, phone, specialization, assignments[] | (subjects[] + classes[]), status,
 *                 jobTitle?, email?, password? }
 * `assignments` = the classes per subject; without it every subject is taught to all `classes`.
 * `password` is the initial sign-in password: required on create, optional on update (resets it).
 */
const validateTeacher = (body, { requirePassword }) => {
  const { fullName, nationalId, phone, email, jobTitle, specialization, subjects, classes, assignments, status, password } =
    body || {};
  const errors = [];

  if (typeof fullName !== 'string' || fullName.trim().length < 3) {
    errors.push({ field: 'fullName', message: 'Full name must be at least 3 characters long' });
  }
  if (typeof nationalId !== 'string' || !NATIONAL_ID_REGEX.test(nationalId.trim())) {
    errors.push({ field: 'nationalId', message: 'National ID must be a valid 14-digit number' });
  }
  if (typeof phone !== 'string' || !EGYPT_MOBILE_REGEX.test(phone.trim())) {
    errors.push({ field: 'phone', message: 'Phone must be a valid 11-digit Egyptian mobile number' });
  }
  if (email !== undefined && email !== null && email !== '' && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) {
    errors.push({ field: 'email', message: 'Email address is not valid' });
  }
  if (jobTitle !== undefined && jobTitle !== null && typeof jobTitle !== 'string') {
    errors.push({ field: 'jobTitle', message: 'Job title must be a string' });
  }
  if (typeof specialization !== 'string' || !specialization.trim()) {
    errors.push({ field: 'specialization', message: 'Specialization is required' });
  }
  if (assignments !== undefined) {
    if (!isAssignmentList(assignments)) {
      errors.push({ field: 'assignments', message: 'assignments must be a non-empty array of { subject, classes[] }' });
    } else if (new Set(assignments.flatMap((a) => a.classes.map((cls) => cls.trim()))).size > MAX_CLASSES) {
      errors.push({ field: 'assignments', message: `A teacher can teach up to ${MAX_CLASSES} classes` });
    }
  } else {
    if (!isStringArray(subjects) || subjects.length === 0) {
      errors.push({ field: 'subjects', message: 'subjects must be a non-empty array of subject names' });
    }
    if (!isStringArray(classes) || classes.length > MAX_CLASSES) {
      errors.push({ field: 'classes', message: `classes must be an array of up to ${MAX_CLASSES} class names` });
    }
  }
  if (!EMPLOYMENT_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `status must be one of: ${EMPLOYMENT_STATUSES.join(', ')}` });
  }
  const passwordGiven = password !== undefined && password !== null && password !== '';
  if ((requirePassword || passwordGiven) && (typeof password !== 'string' || !PASSWORD_REGEX.test(password))) {
    errors.push({ field: 'password', message: PASSWORD_MESSAGE });
  }

  return errors.length ? { message: 'Validation failed', details: errors } : null;
};

export const teachersValidation = {
  createTeacher: (req) => validateTeacher(req.body, { requirePassword: true }),
  updateTeacher: (req) => validateTeacher(req.body, { requirePassword: false }),
};

export default teachersValidation;
