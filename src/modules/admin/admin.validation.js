/**
 * System Permissions Matrix
 */
export const SYSTEM_PERMISSIONS = [
  'students',
  'teachers',
  'classes',
  'exams',
  'attendance-stats',
  'teacher-attendance',
  'academic-year',
  'platform-activity',
  'honor-roll',
  'announcements',
  'home-content',
];

const NATIONAL_ID_REGEX = /^\d{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EGYPT_MOBILE_REGEX = /^01[0125]\d{8}$/;
// Same rule as the admin form: at least 8 characters with letters and digits
const ADMIN_PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
const ADMIN_PASSWORD_MESSAGE = 'Password must be at least 8 characters and contain letters and numbers';

/**
 * Profile fields shared by create & update. With `partial`, missing fields are skipped (PATCH).
 * Email & phone are optional; an empty string clears them.
 */
const validateProfileFields = (body, errors, { partial }) => {
  const { fullName, nationalId, email, phone, jobTitle } = body;

  if (!partial || fullName !== undefined) {
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
      errors.push({ field: 'fullName', message: 'Full name must be at least 3 characters long' });
    }
  }

  if (!partial || nationalId !== undefined) {
    if (!nationalId || typeof nationalId !== 'string' || !NATIONAL_ID_REGEX.test(nationalId.trim())) {
      errors.push({ field: 'nationalId', message: 'National ID must be a valid 14-digit number' });
    }
  }

  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      errors.push({ field: 'email', message: 'Email address is not valid' });
    }
  }

  if (phone !== undefined && phone !== null && phone !== '') {
    if (typeof phone !== 'string' || !EGYPT_MOBILE_REGEX.test(phone.trim())) {
      errors.push({ field: 'phone', message: 'Phone must be a valid 11-digit Egyptian mobile number' });
    }
  }

  if (jobTitle !== undefined && jobTitle !== null && typeof jobTitle !== 'string') {
    errors.push({ field: 'jobTitle', message: 'Job title must be a string' });
  }
};

export const adminValidation = {
  /**
   * Validates Admin Creation Request
   * Body: { fullName, nationalId, password, permissions, email?, phone?, jobTitle? }
   */
  createAdmin: (req) => {
    const { password, permissions } = req.body || {};
    const errors = [];

    validateProfileFields(req.body || {}, errors, { partial: false });

    if (!password || typeof password !== 'string' || !ADMIN_PASSWORD_REGEX.test(password)) {
      errors.push({ field: 'password', message: ADMIN_PASSWORD_MESSAGE });
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        errors.push({ field: 'permissions', message: 'Permissions must be an array of strings' });
      } else {
        const invalidPermissions = permissions.filter((p) => !SYSTEM_PERMISSIONS.includes(p));
        if (invalidPermissions.length > 0) {
          errors.push({
            field: 'permissions',
            message: `Invalid permissions: [${invalidPermissions.join(', ')}]. Allowed: [${SYSTEM_PERMISSIONS.join(', ')}]`,
          });
        }
      }
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  /**
   * Validates Admin Profile Update Request
   * Body (any of): { fullName, nationalId, email, phone, jobTitle }
   */
  updateAdmin: (req) => {
    const body = req.body || {};
    const errors = [];
    const editable = ['fullName', 'nationalId', 'email', 'phone', 'jobTitle'];

    if (!editable.some((field) => body[field] !== undefined)) {
      errors.push({ field: 'body', message: `Provide at least one of: [${editable.join(', ')}]` });
    }

    validateProfileFields(body, errors, { partial: true });

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  /**
   * Validates Permissions Update Request
   * Body: { permissions: string[] }
   */
  updatePermissions: (req) => {
    const { permissions } = req.body || {};
    const errors = [];

    if (!permissions || !Array.isArray(permissions)) {
      errors.push({ field: 'permissions', message: 'Permissions array is required' });
    } else {
      const invalidPermissions = permissions.filter((p) => !SYSTEM_PERMISSIONS.includes(p));
      if (invalidPermissions.length > 0) {
        errors.push({
          field: 'permissions',
          message: `Invalid permissions: [${invalidPermissions.join(', ')}]. Allowed: [${SYSTEM_PERMISSIONS.join(', ')}]`,
        });
      }
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  /**
   * Validates Status Update Request
   * Body: { status: 'ACTIVE' | 'SUSPENDED' }
   */
  updateStatus: (req) => {
    const { status } = req.body || {};
    const allowedStatuses = ['ACTIVE', 'SUSPENDED'];

    if (!status || !allowedStatuses.includes(status)) {
      return {
        message: 'Validation failed',
        details: [{ field: 'status', message: `Status must be one of: [${allowedStatuses.join(', ')}]` }],
      };
    }
    return null;
  },

  /**
   * Validates Password Reset Request
   * Body: { newPassword: string }
   */
  resetPassword: (req) => {
    const { newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || !ADMIN_PASSWORD_REGEX.test(newPassword)) {
      return {
        message: 'Validation failed',
        details: [{ field: 'newPassword', message: ADMIN_PASSWORD_MESSAGE }],
      };
    }
    return null;
  },
};

export default adminValidation;

