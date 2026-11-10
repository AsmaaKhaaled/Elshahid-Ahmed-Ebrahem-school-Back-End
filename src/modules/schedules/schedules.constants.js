/**
 * Timetable & Schedules System Constants
 */

export const DEFAULT_TERM_ID = '2026-2027-T1';

export const DAY_NAMES = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
};

export const PERIOD_TIMINGS = {
  1: '08:00 - 08:45 AM',
  2: '08:50 - 09:35 AM',
  3: '09:40 - 10:25 AM',
  4: '10:55 - 11:40 AM',
  5: '11:45 - 12:30 PM',
  6: '12:35 - 01:20 PM',
  7: '01:25 - 02:05 PM',
};

export const PERIOD_ORDINALS = {
  1: 'الأولى',
  2: 'الثانية',
  3: 'الثالثة',
  4: 'الرابعة',
  5: 'الخامسة',
  6: 'السادسة',
  7: 'السابعة',
};

export const BREAK_TIME = '10:25 - 10:55 AM';

const RELIGION_PERIODS = {
  'التربية الدينية': 3,
  'التربية الدينية الإسلامية': 3,
  'التربية الدينية المسيحية': 3,
};

/**
 * Most periods a class may have per week in each subject, by grade (same as the frontend's WEEKLY_PERIOD_LIMITS).
 * Muslim and Christian students study religion at the same time, so each religion has its own limit.
 */
export const WEEKLY_PERIOD_LIMITS = {
  1: {
    'اللغة العربية': 8,
    'الرياضيات': 6,
    'اللغة الإنجليزية': 5,
    'الدراسات الاجتماعية': 4,
    'العلوم': 4,
    ...RELIGION_PERIODS,
    'الحاسب الآلي': 1,
    'التربية الفنية': 1,
    'التربية الرياضية': 1,
  },
  2: {
    'اللغة العربية': 8,
    'الرياضيات': 6,
    'اللغة الإنجليزية': 6,
    'الدراسات الاجتماعية': 4,
    'العلوم': 4,
    ...RELIGION_PERIODS,
    'الحاسب الآلي': 1,
    'التربية الفنية': 1,
    'التربية الرياضية': 1,
  },
  3: {
    'اللغة العربية': 8,
    'الرياضيات': 6,
    'اللغة الإنجليزية': 6,
    'الدراسات الاجتماعية': 4,
    'العلوم': 4,
    ...RELIGION_PERIODS,
    'الحاسب الآلي': 1,
    'التربية الفنية': 1,
    'التربية الرياضية': 0,
  },
};

/** The weekly limit of a subject in a class named like "2/3"; undefined when the school set none. */
export const weeklyPeriodLimit = (className, subject) =>
  WEEKLY_PERIOD_LIMITS[String(className).split('/')[0]]?.[subject];

/**
 * Convert slot key (e.g. "0-0" or "0-1") to { dayOfWeek, period }
 * Slot key in frontend is `day-periodIndex` (0-0 = Sunday Period 1, 0-1 = Sunday Period 2)
 */
export const parseSlotKey = (slotKey) => {
  if (!slotKey || typeof slotKey !== 'string') return null;
  const parts = slotKey.trim().split('-');
  if (parts.length !== 2) return null;
  const dayOfWeek = parseInt(parts[0], 10);
  const periodIndex = parseInt(parts[1], 10);
  if (isNaN(dayOfWeek) || isNaN(periodIndex)) return null;

  return {
    dayOfWeek,
    period: periodIndex + 1, // 0-based to 1-based period (1 to 7)
  };
};

/**
 * Format { dayOfWeek, period } to frontend slotKey "day-periodIndex" (e.g. "0-0")
 */
export const formatSlotKey = (dayOfWeek, period) => {
  const periodIndex = period - 1;
  return `${dayOfWeek}-${periodIndex}`;
};

export default {
  DEFAULT_TERM_ID,
  DAY_NAMES,
  PERIOD_TIMINGS,
  PERIOD_ORDINALS,
  BREAK_TIME,
  parseSlotKey,
  formatSlotKey,
};

