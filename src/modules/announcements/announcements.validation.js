export const announcementsValidation = {
  createAnnouncement: (req) => {
    const { title, content, type, targetAudience, priority, classId } = req.body || {};
    const errors = [];

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Announcement title is required' });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      errors.push({ field: 'content', message: 'Announcement content is required' });
    }

    const validTypes = ['SCHOOL_WIDE', 'CLASS_NOTE'];
    if (type && !validTypes.includes(type.toUpperCase())) {
      errors.push({ field: 'type', message: `Type must be one of: ${validTypes.join(', ')}` });
    }

    if (type === 'CLASS_NOTE' && !classId) {
      errors.push({ field: 'classId', message: 'classId is required when creating a CLASS_NOTE' });
    }

    const validAudiences = ['ALL', 'TEACHERS', 'STUDENTS', 'PARENTS'];
    if (targetAudience && !validAudiences.includes(targetAudience.toUpperCase())) {
      errors.push({ field: 'targetAudience', message: `Target audience must be one of: ${validAudiences.join(', ')}` });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (priority && !validPriorities.includes(priority.toUpperCase())) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${validPriorities.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateAnnouncement: (req) => {
    const { title, content } = req.body || {};
    const errors = [];

    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      errors.push({ field: 'title', message: 'Announcement title cannot be empty' });
    }

    if (content !== undefined && (typeof content !== 'string' || content.trim().length === 0)) {
      errors.push({ field: 'content', message: 'Announcement content cannot be empty' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default announcementsValidation;
