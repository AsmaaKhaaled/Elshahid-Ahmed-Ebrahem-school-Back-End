import { SCHOOL_SUBJECT_NAMES, isSchoolSubject } from '../../shared/constants/school-subjects.js';
import { normalizeNationalId, normalizePhone, nationalIdError, phoneError } from '../../shared/utils/egyptian-ids.js';

export const EMPLOYMENT_STATUSES = ['ON_DUTY', 'ON_LEAVE', 'SECONDED'];
const SUBJECTS_MESSAGE = `المواد يجب أن تكون من مواد المدرسة: ${SCHOOL_SUBJECT_NAMES.join('، ')}`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same rule as admin accounts: at least 8 characters with letters and digits
const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
const PASSWORD_MESSAGE = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف إنجليزية وأرقام';
const MAX_CLASSES = 20;

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim());
const isText = (value) => typeof value === 'string' || typeof value === 'number';

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
 * National ID & phone are checked after cleaning (Arabic digits, spaces, dashes), the way they are stored.
 */
const validateTeacher = (body, { requirePassword }) => {
  const { fullName, nationalId, phone, email, jobTitle, specialization, subjects, classes, assignments, status, password } =
    body || {};
  const errors = [];

  if (typeof fullName !== 'string' || fullName.trim().length < 3) {
    errors.push({ field: 'fullName', message: 'اسم المعلم مطلوب (3 أحرف على الأقل)' });
  }
  const nidMessage = isText(nationalId) ? nationalIdError(normalizeNationalId(nationalId)) : 'الرقم القومي للمعلم مطلوب';
  if (nidMessage) {
    errors.push({ field: 'nationalId', message: nidMessage });
  }
  const phoneMessage = isText(phone) ? phoneError(normalizePhone(phone)) : 'رقم موبايل المعلم مطلوب';
  if (phoneMessage) {
    errors.push({ field: 'phone', message: phoneMessage });
  }
  if (email !== undefined && email !== null && email !== '' && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) {
    errors.push({ field: 'email', message: 'البريد الإلكتروني غير صحيح' });
  }
  if (jobTitle !== undefined && jobTitle !== null && typeof jobTitle !== 'string') {
    errors.push({ field: 'jobTitle', message: 'المسمى الوظيفي يجب أن يكون نصاً' });
  }
  if (typeof specialization !== 'string' || !specialization.trim()) {
    errors.push({ field: 'specialization', message: 'التخصص مطلوب' });
  }
  if (assignments !== undefined) {
    if (!isAssignmentList(assignments)) {
      errors.push({ field: 'assignments', message: 'يجب تحديد مادة واحدة على الأقل والفصول التي يدرّسها فيها' });
    } else if (!assignments.every((a) => isSchoolSubject(a.subject))) {
      errors.push({ field: 'assignments', message: SUBJECTS_MESSAGE });
    } else if (new Set(assignments.flatMap((a) => a.classes.map((cls) => cls.trim()))).size > MAX_CLASSES) {
      errors.push({ field: 'assignments', message: `المعلم يدرّس ${MAX_CLASSES} فصل كحد أقصى` });
    }
  } else {
    if (!isStringArray(subjects) || subjects.length === 0) {
      errors.push({ field: 'subjects', message: 'يجب اختيار مادة واحدة على الأقل' });
    } else if (!subjects.every(isSchoolSubject)) {
      errors.push({ field: 'subjects', message: SUBJECTS_MESSAGE });
    }
    if (!Array.isArray(classes) || !classes.every((c) => typeof c === 'string' && c.trim()) || classes.length > MAX_CLASSES) {
      errors.push({ field: 'classes', message: `الفصول يجب أن تكون قائمة بحد أقصى ${MAX_CLASSES} فصل` });
    }
  }
  if (!EMPLOYMENT_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: 'الحالة الوظيفية يجب أن تكون: على رأس العمل / إجازة / منتدب' });
  }
  const passwordGiven = password !== undefined && password !== null && password !== '';
  if ((requirePassword || passwordGiven) && (typeof password !== 'string' || !PASSWORD_REGEX.test(password))) {
    errors.push({ field: 'password', message: PASSWORD_MESSAGE });
  }

  return errors.length ? { message: 'فشل التحقق من صحة البيانات', details: errors } : null;
};

export const teachersValidation = {
  createTeacher: (req) => validateTeacher(req.body, { requirePassword: true }),
  updateTeacher: (req) => validateTeacher(req.body, { requirePassword: false }),
};

export default teachersValidation;
