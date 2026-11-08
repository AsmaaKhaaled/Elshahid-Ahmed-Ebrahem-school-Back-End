export const usersValidation = {
  createUser: (req) => {
    const { name, email, password, role } = req.body || {};
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      errors.push({ field: 'email', message: 'Valid email is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
    }

    // "users" is for the administration: teachers & students are added on their own pages
    if (role && role !== 'ADMIN') {
      errors.push({ field: 'role', message: 'Only ADMIN accounts are created here (teachers & students have their own pages)' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  updateUser: (req) => {
    const { name, email, role } = req.body || {};
    const errors = [];

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({ field: 'email', message: 'Valid email is required' });
      }
    }

    if (role !== undefined) {
      errors.push({ field: 'role', message: 'The role is not changed here' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },

  changePassword: (req) => {
    const { currentPassword, newPassword } = req.body || {};
    const errors = [];

    if (!currentPassword || typeof currentPassword !== 'string') {
      errors.push({ field: 'currentPassword', message: 'Current password is required' });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      errors.push({ field: 'newPassword', message: 'New password must be at least 6 characters long' });
    }

    if (errors.length > 0) {
      return { message: 'Validation failed', details: errors };
    }
    return null;
  },
};

export default usersValidation;
