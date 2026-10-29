export const authValidation = {
  register: (req) => {
    const { name, email, password, role } = req.body || {};
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.push({ field: 'email', message: 'Valid email address is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
    }

    const validRoles = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];
    if (role && !validRoles.includes(role)) {
      errors.push({ field: 'role', message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  login: (req) => {
    const { email, password } = req.body || {};
    const errors = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.push({ field: 'email', message: 'Valid email address is required' });
    }

    if (!password || typeof password !== 'string') {
      errors.push({ field: 'password', message: 'Password is required' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  refreshToken: (req) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== 'string') {
      return {
        message: 'Validation failed',
        details: [{ field: 'refreshToken', message: 'Refresh token string is required' }],
      };
    }
    return null;
  },
};

export default authValidation;

