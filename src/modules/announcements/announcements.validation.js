export const announcementsValidation = {
  createAnnouncement: (req) => {
    const { title, content, audiences, type, classId, category } = req.body || {};
    const errors = [];

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push({ field: 'title', message: 'عنوان الإعلان أو التعميم مطلوب' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      errors.push({ field: 'content', message: 'نص الإعلان مطلوب' });
    }

    if (type === 'CLASS_NOTE' && !classId) {
      errors.push({ field: 'classId', message: 'معرف الفصل classId مطلوب عند نشر ملاحظة فصل' });
    }

    if (audiences !== undefined) {
      const allowed = ['TEACHER', 'STUDENT', 'PARENT', 'ALL'];
      const list = Array.isArray(audiences) ? audiences : [audiences];
      for (const aud of list) {
        if (!allowed.includes(String(aud).toUpperCase())) {
          errors.push({
            field: 'audiences',
            message: `الفئات المستهدفة يجب أن تكون من ضمن: ${allowed.join(', ')}`,
          });
          break;
        }
      }
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },

  updateAnnouncement: (req) => {
    const { title, content } = req.body || {};
    const errors = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      errors.push({ field: 'title', message: 'عنوان الإعلان لا يمكن أن يكون فارغاً' });
    }

    if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
      errors.push({ field: 'content', message: 'نص الإعلان لا يمكن أن يكون فارغاً' });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },
};

export default announcementsValidation;
