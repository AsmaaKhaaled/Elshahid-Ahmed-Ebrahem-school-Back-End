/**
 * The school's subjects: the one list teachers' assignments, curricula, exams and grades use,
 * so a subject has the same name everywhere (same as the frontend's SCHOOL_SUBJECTS).
 * Migration 20261106120000_school_subjects puts these rows in the subjects table.
 */
export const SCHOOL_SUBJECTS = [
  { code: 'ARB', nameArabic: 'اللغة العربية', nameEnglish: 'Arabic' },
  { code: 'ENG', nameArabic: 'اللغة الإنجليزية', nameEnglish: 'English' },
  { code: 'MATH', nameArabic: 'الرياضيات', nameEnglish: 'Mathematics' },
  { code: 'SCI', nameArabic: 'العلوم', nameEnglish: 'Science' },
  { code: 'SOC', nameArabic: 'الدراسات الاجتماعية', nameEnglish: 'Social Studies' },
  { code: 'REL-ISL', nameArabic: 'التربية الدينية الإسلامية', nameEnglish: 'Islamic Religious Education' },
  { code: 'REL-CHR', nameArabic: 'التربية الدينية المسيحية', nameEnglish: 'Christian Religious Education' },
  { code: 'CS', nameArabic: 'الحاسب الآلي', nameEnglish: 'Computer Science' },
  { code: 'ART', nameArabic: 'التربية الفنية', nameEnglish: 'Art Education' },
  { code: 'PE', nameArabic: 'التربية الرياضية', nameEnglish: 'Physical Education' },
];

export const SCHOOL_SUBJECT_NAMES = SCHOOL_SUBJECTS.map((subject) => subject.nameArabic);

export const isSchoolSubject = (name) => typeof name === 'string' && SCHOOL_SUBJECT_NAMES.includes(name.trim());
