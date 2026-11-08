import { parseSlotKey } from './schedules.constants.js';

// Most a teacher can have: 5 days x 7 periods
const MAX_SLOTS = 35;
const TERM_ID_REGEX = /^\d{4}-\d{4}-T[1-3]$/;

export const schedulesValidation = {
  /**
   * PUT /schedules/teachers/:teacherId
   * Body: { termId?: "2026-2027-T1", slots: [{ dayOfWeek, period } | { slotKey }, classId | className | section, subject, room? }] }
   */
  saveTeacherSchedule: (req) => {
    const { termId, slots } = req.body || {};
    const errors = [];

    if (termId !== undefined && termId !== null && termId !== '' && (typeof termId !== 'string' || !TERM_ID_REGEX.test(termId.trim()))) {
      errors.push({ field: 'termId', message: 'الترم يجب أن يكون بالشكل 2026-2027-T1' });
    }

    if (!Array.isArray(slots)) {
      errors.push({ field: 'slots', message: 'يجب إرسال مصفوفة الحصص (slots: Array)' });
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    if (slots.length > MAX_SLOTS) {
      errors.push({ field: 'slots', message: `أقصى عدد حصص للمعلم ${MAX_SLOTS} حصة في الأسبوع` });
    }

    slots.forEach((rawItem, index) => {
      const item = rawItem && typeof rawItem === 'object' ? rawItem : {};
      let day = item.dayOfWeek !== undefined ? Number(item.dayOfWeek) : undefined;
      let period = item.period !== undefined ? Number(item.period) : undefined;

      // Support slotKey if day/period not directly supplied
      if ((day === undefined || period === undefined) && item.slotKey) {
        const parsed = parseSlotKey(item.slotKey);
        if (parsed) {
          day = parsed.dayOfWeek;
          period = parsed.period;
        }
      }

      if (!Number.isInteger(day) || day < 0 || day > 4) {
        errors.push({
          field: `slots[${index}].dayOfWeek`,
          message: 'اليوم الدراسي يجب أن يكون بين 0 (الأحد) و 4 (الخميس)',
        });
      }

      if (!Number.isInteger(period) || period < 1 || period > 7) {
        errors.push({
          field: `slots[${index}].period`,
          message: 'رقم الحصة يجب أن يكون بين 1 و 7',
        });
      }

      const cls = item.classId ?? item.className ?? item.section;
      if (typeof cls !== 'string' || !cls.trim()) {
        errors.push({
          field: `slots[${index}].classId`,
          message: 'معرف الفصل أو اسم الفصل مطلوب',
        });
      }

      if (!item.subject || typeof item.subject !== 'string' || item.subject.trim().length === 0) {
        errors.push({
          field: `slots[${index}].subject`,
          message: 'المادة الدراسية مطلوبة',
        });
      }

      if (item.room !== undefined && item.room !== null && typeof item.room !== 'string' && typeof item.room !== 'number') {
        errors.push({ field: `slots[${index}].room`, message: 'رقم القاعة يجب أن يكون نصاً' });
      }
    });

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }

    return null;
  },
};

export default schedulesValidation;
