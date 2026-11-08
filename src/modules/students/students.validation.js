/**
 * Student Module Request Validation Schemas
 * (field rules that need the database, e.g. "the class exists" / "the class isn't full", are in the service)
 */
import { normalizeNationalId, normalizePhone, nationalIdError, phoneError } from '../../shared/utils/egyptian-ids.js';

const STATUSES = ['منتظم', 'موقوف', 'منقول'];
const MAX_IMPORT_ROWS = 2000;

const isText = (value) => typeof value === 'string' || typeof value === 'number';
const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

// Values are checked after cleaning (Arabic digits, spaces, dashes), the same way the service stores them
const nationalIdMessage = (value) => {
  if (!isText(value) || isBlank(value)) return 'الرقم القومي للطالب مطلوب';
  return nationalIdError(normalizeNationalId(value));
};

const guardianPhoneMessage = (value) => {
  if (!isText(value) || isBlank(value)) return 'رقم هاتف ولي الأمر مطلوب';
  const message = phoneError(normalizePhone(value));
  return message && `هاتف ولي الأمر: ${message}`;
};

const nameMessage = (value, label) =>
  typeof value !== 'string' || value.trim().length < 3 ? `${label} مطلوب (3 أحرف على الأقل)` : null;

const genderMessage = (value) =>
  !isBlank(value) && (typeof value !== 'string' || !['MALE', 'FEMALE'].includes(value.trim().toUpperCase()))
    ? "النوع يجب أن يكون 'MALE' أو 'FEMALE'"
    : null;

const statusMessage = (value) =>
  !isBlank(value) && (typeof value !== 'string' || !STATUSES.includes(value.trim()))
    ? `حالة القيد يجب أن تكون: ${STATUSES.join(' / ')}`
    : null;

const optionalTextMessage = (value, label) =>
  value !== undefined && value !== null && !isText(value) ? `${label} يجب أن يكون نصاً` : null;

const result = (errors) => (errors.length ? { message: 'فشل التحقق من صحة البيانات', details: errors } : null);

const collect = (checks) =>
  checks.filter(([, message]) => message).map(([field, message]) => ({ field, message }));

export const studentsValidation = {
  createStudent: (req) => {
    const body = req.body || {};
    return result(
      collect([
        ['fullNameArabic', nameMessage(body.fullNameArabic ?? body.fullName, 'اسم الطالب باللغة العربية')],
        ['nationalId', nationalIdMessage(body.nationalId)],
        ['studentCode', optionalTextMessage(body.studentCode, 'كود الطالب')],
        ['guardianName', nameMessage(body.guardianName, 'اسم ولي الأمر')],
        ['guardianPhone', guardianPhoneMessage(body.guardianPhone)],
        ['gradeLevel', optionalTextMessage(body.gradeLevel, 'الصف الدراسي')],
        ['classId', optionalTextMessage(body.classId ?? body.className, 'الفصل')],
        ['enrollmentStatus', statusMessage(body.enrollmentStatus)],
        ['gender', genderMessage(body.gender)],
      ])
    );
  },

  updateStudent: (req) => {
    const body = req.body || {};
    const sent = (key) => body[key] !== undefined;
    return result(
      collect([
        ['fullNameArabic', sent('fullNameArabic') && nameMessage(body.fullNameArabic, 'اسم الطالب باللغة العربية')],
        ['nationalId', sent('nationalId') && nationalIdMessage(body.nationalId)],
        [
          'studentCode',
          sent('studentCode') && (!isText(body.studentCode) || isBlank(body.studentCode)) && 'كود الطالب لا يمكن أن يكون فارغاً',
        ],
        ['guardianName', sent('guardianName') && nameMessage(body.guardianName, 'اسم ولي الأمر')],
        ['guardianPhone', sent('guardianPhone') && guardianPhoneMessage(body.guardianPhone)],
        ['gradeLevel', optionalTextMessage(body.gradeLevel, 'الصف الدراسي')],
        ['classId', optionalTextMessage(body.classId ?? body.className, 'الفصل')],
        ['enrollmentStatus', statusMessage(body.enrollmentStatus)],
        ['gender', genderMessage(body.gender)],
      ])
    );
  },

  enroll: (req) => {
    const { classId, className } = req.body || {};
    const value = classId ?? className;
    return result(
      collect([['classId', (!isText(value) || isBlank(value)) && 'الفصل مطلوب لتسكين الطالب (classId أو className)']])
    );
  },

  distribute: (req) => {
    const { gradeLevel } = req.body || {};
    return result(collect([['gradeLevel', optionalTextMessage(gradeLevel, 'الصف الدراسي')]]));
  },

  bulkImport: (req) => {
    const { students } = req.body || {};
    if (!Array.isArray(students) || students.length === 0) {
      return result([{ field: 'students', message: 'يجب إرسال مصفوفة تحتوي على بيانات الطلاب في body.students' }]);
    }
    if (students.length > MAX_IMPORT_ROWS) {
      return result([{ field: 'students', message: `الحد الأقصى ${MAX_IMPORT_ROWS} طالب في المرة الواحدة` }]);
    }
    return null;
  },
};

export default studentsValidation;
