/**
 * Authentication Module Request Validation
 */

export const loginSchema = (req) => {
  const { identifier, password } = req?.body || req || {};
  const errors = [];

  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    errors.push({
      field: 'identifier',
      message: 'Identifier is required (Email, Student Code, or National ID)',
    });
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push({
      field: 'password',
      message: 'Password is required',
    });
  }

  if (errors.length > 0) {
    return {
      message: 'Validation failed',
      details: errors,
    };
  }

  return null;
};

export const setInitialPasswordSchema = (req) => {
  const { newPassword, confirmPassword } = req?.body || req || {};
  const errors = [];

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    errors.push({
      field: 'newPassword',
      message: 'New password must be at least 6 characters long',
    });
  }

  if (!confirmPassword || typeof confirmPassword !== 'string') {
    errors.push({
      field: 'confirmPassword',
      message: 'Confirm password is required',
    });
  } else if (newPassword && newPassword !== confirmPassword) {
    errors.push({
      field: 'confirmPassword',
      message: 'Passwords do not match',
    });
  }

  if (errors.length > 0) {
    return {
      message: 'Validation failed',
      details: errors,
    };
  }

  return null;
};

export const authValidation = {
  login: loginSchema,
  setInitialPassword: setInitialPasswordSchema,
  loginSchema,
  setInitialPasswordSchema,
};

export default authValidation;
