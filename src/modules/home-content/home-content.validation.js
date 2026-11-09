export const homeContentValidation = {
  updatePrincipalWord: (req) => {
    const { name, title, photoUrl, message } = req.body || {};
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 60) {
      errors.push({
        field: 'name',
        message: 'اسم المدير مطلوب ويجب أن يكون بين 3 و 60 حرفاً',
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 50) {
      errors.push({
        field: 'title',
        message: 'المسمى الوظيفي مطلوب ويجب أن يكون بين 2 و 50 حرفاً',
      });
    }

    if (photoUrl !== undefined && photoUrl !== null && typeof photoUrl !== 'string') {
      errors.push({
        field: 'photoUrl',
        message: 'رابط الصورة يجب أن يكون نصياً',
      });
    }

    if (!message) {
      errors.push({
        field: 'message',
        message: 'نص الكلمة مطلوب ويجب ألا يكون فارغاً',
      });
    } else if (Array.isArray(message)) {
      const validParagraphs = message
        .filter((p) => typeof p === 'string' && p.trim().length > 0);
      if (validParagraphs.length === 0) {
        errors.push({
          field: 'message',
          message: 'يجب كتابة فقرة واحدة على الأقل في كلمة مدير المدرسة',
        });
      }
    } else if (typeof message === 'string') {
      if (message.trim().length === 0) {
        errors.push({
          field: 'message',
          message: 'يجب كتابة فقرة واحدة على الأقل في كلمة مدير المدرسة',
        });
      }
    } else {
      errors.push({
        field: 'message',
        message: 'نص الكلمة يجب أن يكون مصفوفة نصوص أو نصاً',
      });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة البيانات', details: errors };
    }
    return null;
  },
};

export default homeContentValidation;

