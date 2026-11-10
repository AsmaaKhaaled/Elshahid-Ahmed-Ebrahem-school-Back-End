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

  createGallerySlide: (req) => {
    const { title, caption, src, hidden } = req.body || {};
    const errors = [];

    if (!title || typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100) {
      errors.push({
        field: 'title',
        message: 'عنوان النشاط مطلوب ويجب أن يكون بين 2 و 100 حرف',
      });
    }

    if (caption !== undefined && caption !== null && typeof caption === 'string' && caption.trim().length > 300) {
      errors.push({
        field: 'caption',
        message: 'وصف النشاط يجب ألا يتجاوز 300 حرف',
      });
    }

    if (!src || typeof src !== 'string' || src.trim().length < 5) {
      errors.push({
        field: 'src',
        message: 'رابط الصورة أو بيانات الصورة (src) مطلوب',
      });
    }

    if (hidden !== undefined && typeof hidden !== 'boolean') {
      errors.push({
        field: 'hidden',
        message: 'حقل الإخفاء (hidden) يجب أن يكون قيمة منطقية (boolean)',
      });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة بيانات الصورة', details: errors };
    }
    return null;
  },

  updateGallerySlide: (req) => {
    const { title, caption, src, hidden, order } = req.body || {};
    const errors = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100)) {
      errors.push({
        field: 'title',
        message: 'عنوان النشاط يجب أن يكون بين 2 و 100 حرف',
      });
    }

    if (caption !== undefined && caption !== null && typeof caption === 'string' && caption.trim().length > 300) {
      errors.push({
        field: 'caption',
        message: 'وصف النشاط يجب ألا يتجاوز 300 حرف',
      });
    }

    if (src !== undefined && (typeof src !== 'string' || src.trim().length < 5)) {
      errors.push({
        field: 'src',
        message: 'رابط الصورة غير صالح',
      });
    }

    if (hidden !== undefined && typeof hidden !== 'boolean') {
      errors.push({
        field: 'hidden',
        message: 'حقل الإخفاء (hidden) يجب أن يكون قيمة منطقية (boolean)',
      });
    }

    if (order !== undefined && (!Number.isInteger(order) || order < 0)) {
      errors.push({
        field: 'order',
        message: 'حقل الترتيب (order) يجب أن يكون رقماً صحيحاً موجباً',
      });
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة بيانات الصورة', details: errors };
    }
    return null;
  },

  reorderGallerySlides: (req) => {
    const { slideIds } = req.body || {};
    const errors = [];

    if (!slideIds || !Array.isArray(slideIds) || slideIds.length === 0) {
      errors.push({
        field: 'slideIds',
        message: 'مصفوفة معرفات الصور (slideIds) مطلوبة ولا يمكن أن تكون فارغة',
      });
    } else {
      const hasInvalidItem = slideIds.some((id) => typeof id !== 'string' || id.trim().length === 0);
      if (hasInvalidItem) {
        errors.push({
          field: 'slideIds',
          message: 'جميع المعرفات داخل مصفوفة slideIds يجب أن تكون نصوصاً صالحة',
        });
      }
    }

    if (errors.length > 0) {
      return { message: 'فشل التحقق من صحة بيانات إعادة الترتيب', details: errors };
    }
    return null;
  },
};

export default homeContentValidation;

