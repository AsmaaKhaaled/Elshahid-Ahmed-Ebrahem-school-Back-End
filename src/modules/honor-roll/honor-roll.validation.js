export const honorRollValidation = {
  searchCandidates: (req) => {
    const { type } = req.query || {};
    const errors = [];

    if (!type || !['TEACHER', 'STUDENT'].includes(String(type).toUpperCase())) {
      errors.push({
        field: 'type',
        message: 'نوع البحث مطلوب ويجب أن يكون TEACHER أو STUDENT',
      });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من معايير البحث', details: errors };
    }
    return null;
  },

  createHonorRoll: (req) => {
    const { kind, name, section, subjects } = req.body || {};
    const errors = [];

    if (!kind || !['TEACHER', 'STUDENT'].includes(String(kind).toUpperCase())) {
      errors.push({
        field: 'kind',
        message: 'نوع التكريم مطلوب ويجب أن يكون TEACHER أو STUDENT',
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({
        field: 'name',
        message: 'الاسم مطلوب ويجب ألا يقل عن حرفين',
      });
    }

    const normalizedKind = String(kind).toUpperCase();

    if (normalizedKind === 'STUDENT') {
      if (!section || typeof section !== 'string' || section.trim().length === 0) {
        errors.push({
          field: 'section',
          message: 'الفصل الدراسي مطلوب للطالب المكرم (مثال: 3/1 أو 1/2)',
        });
      }
    }

    if (normalizedKind === 'TEACHER') {
      if (
        !subjects ||
        !Array.isArray(subjects) ||
        subjects.filter((s) => typeof s === 'string' && s.trim().length > 0).length === 0
      ) {
        errors.push({
          field: 'subjects',
          message: 'يجب تحديد مادة دراسية واحدة على الأقل للمعلم المكرم',
        });
      }
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },

  updateHonorRoll: (req) => {
    const { kind, name, section, subjects } = req.body || {};
    const errors = [];

    if (kind !== undefined && !['TEACHER', 'STUDENT'].includes(String(kind).toUpperCase())) {
      errors.push({
        field: 'kind',
        message: 'نوع التكريم يجب أن يكون TEACHER أو STUDENT',
      });
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      errors.push({
        field: 'name',
        message: 'الاسم لا يمكن أن يقل عن حرفين',
      });
    }

    if (section !== undefined && (typeof section !== 'string' || section.trim().length === 0)) {
      errors.push({
        field: 'section',
        message: 'الفصل الدراسي لا يمكن أن يكون فارغاً',
      });
    }

    if (
      subjects !== undefined &&
      (!Array.isArray(subjects) ||
        subjects.filter((s) => typeof s === 'string' && s.trim().length > 0).length === 0)
    ) {
      errors.push({
        field: 'subjects',
        message: 'يجب أن تحتوي قائمة المواد على مادة واحدة على الأقل',
      });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },
};

export default honorRollValidation;

