/**
 * Student Module Request Validation Schemas
 */

export const studentsValidation = {
  createStudent: (req) => {
    const {
      fullNameArabic,
      fullName,
      nationalId,
      studentCode,
      classId,
      className,
      gradeLevel,
      guardianName,
      guardianPhone,
      enrollmentStatus,
      gender,
    } = req.body || {};
    const errors = [];

    const name = fullNameArabic || fullName;
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      errors.push({
        field: 'fullNameArabic',
        message: 'الاسم رباعي باللغة العربية مطلوب (3 أحرف على الأقل)',
      });
    }

    if (!nationalId || typeof nationalId !== 'string' || !/^\d{14}$/.test(nationalId.trim())) {
      errors.push({
        field: 'nationalId',
        message: 'الرقم القومي للطالب مطلوب ويجب أن يتكون من 14 رقماً',
      });
    }

    if (studentCode !== undefined && (typeof studentCode !== 'string' || studentCode.trim().length === 0)) {
      errors.push({
        field: 'studentCode',
        message: 'كود الطالب يجب أن يكون نصاً صالحاً',
      });
    }

    if (!guardianName || typeof guardianName !== 'string' || guardianName.trim().length < 3) {
      errors.push({
        field: 'guardianName',
        message: 'اسم ولي الأمر مطلوب',
      });
    }

    if (!guardianPhone || typeof guardianPhone !== 'string' || guardianPhone.trim().length < 8) {
      errors.push({
        field: 'guardianPhone',
        message: 'رقم هاتف ولي الأمر مطلوب ويجب أن يكون صحيحاً',
      });
    }

    if (gender && !['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
      errors.push({ field: 'gender', message: "النوع يجب أن يكون 'MALE' أو 'FEMALE'" });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },

  updateStudent: (req) => {
    const { fullNameArabic, nationalId, guardianPhone, gender } = req.body || {};
    const errors = [];

    if (fullNameArabic !== undefined && (typeof fullNameArabic !== 'string' || fullNameArabic.trim().length < 3)) {
      errors.push({ field: 'fullNameArabic', message: 'الاسم باللغة العربية يجب أن يتكون من 3 أحرف على الأقل' });
    }

    if (nationalId !== undefined && (typeof nationalId !== 'string' || !/^\d{14}$/.test(nationalId.trim()))) {
      errors.push({ field: 'nationalId', message: 'الرقم القومي يجب أن يتكون من 14 رقماً' });
    }

    if (guardianPhone !== undefined && (typeof guardianPhone !== 'string' || guardianPhone.trim().length < 8)) {
      errors.push({ field: 'guardianPhone', message: 'رقم هاتف ولي الأمر يجب أن يكون صالحاً' });
    }

    if (gender !== undefined && !['MALE', 'FEMALE'].includes(gender.toUpperCase())) {
      errors.push({ field: 'gender', message: "النوع يجب أن يكون 'MALE' أو 'FEMALE'" });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },

  enroll: (req) => {
    const { classId } = req.body || {};
    if (!classId || typeof classId !== 'string') {
      return {
        message: 'فشل التحقق من صحة البيانات',
        details: [{ field: 'classId', message: 'معرف الفصل مطلوب لتسكين الطالب' }],
      };
    }
    return null;
  },

  bulkImport: (req) => {
    const { students } = req.body || {};
    if (!students || !Array.isArray(students) || students.length === 0) {
      return {
        message: 'فشل التحقق من صحة البيانات',
        details: [{ field: 'students', message: 'يجب إرسال مصفوفة تحتوي على بيانات الطلاب في body.students' }],
      };
    }
    return null;
  },
};

export default studentsValidation;
