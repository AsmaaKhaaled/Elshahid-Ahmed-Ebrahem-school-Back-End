import { parseSlotKey } from './schedules.constants.js';

export const schedulesValidation = {
  saveTeacherSchedule: (req) => {
    const { termId, slots } = req.body || {};
    const errors = [];

    if (!Array.isArray(slots)) {
      errors.push({
        field: 'slots',
        message: 'يجب إرسال مصفوفة الحصص (slots: Array)',
      });
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }

    // Validate each slot item
    slots.forEach((item, index) => {
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

      if (day === undefined || isNaN(day) || day < 0 || day > 4) {
        errors.push({
          field: `slots[${index}].dayOfWeek`,
          message: 'اليوم الدراسي يجب أن يكون بين 0 (الأحد) و 4 (الخميس)',
        });
      }

      if (period === undefined || isNaN(period) || period < 1 || period > 7) {
        errors.push({
          field: `slots[${index}].period`,
          message: 'رقم الحصة يجب أن يكون بين 1 و 7',
        });
      }

      if (!item.classId && !item.className) {
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
    });

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }

    return null;
  },
};

export default schedulesValidation;

