/**
 * System Permissions Matrix
 */
export const SYSTEM_PERMISSIONS = [
  'students',
  'teachers',
  'classes',
  'assignments',
  'exams',
  'attendance-stats',
  'teacher-attendance',
  'academic-year',
  'platform-activity',
  'honor-roll',
  'announcements',
];

export const adminValidation = {
  /**
   * Validates Admin Creation Request
   * Body: { fullName, nationalId, email, password, permissions }
   */
  createAdmin: (req) => {
    const { fullName, nationalId, email, password, permissions } = req.body || {};
    const errors = [];

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
      errors.push({ field: 'fullName', message: 'Full name must be at least 3 characters long' });
    }

    if (!nationalId || typeof nationalId !== 'string' || !/^\d{14}$/.test(nationalId.trim())) {
      errors.push({ field: 'nationalId', message: 'National ID must be a valid 14-digit number' });
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.push({ field: 'email', message: 'Valid email address is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
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
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return {
        message: 'Validation failed',
        details: [{ field: 'newPassword', message: 'New password must be at least 6 characters long' }],
      };
    }
    return null;
  },
};

export default adminValidation;

