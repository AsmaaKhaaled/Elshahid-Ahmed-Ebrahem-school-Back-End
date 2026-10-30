/**
 * Authentication Module Request Validation
 */

const FORBIDDEN_DEFAULT_PASSWORDS = ['Student@2026', 'Teacher@2026'];
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

/**
 * Validates Login Request Body
 * Requires identifier (trimmed string) and password
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

/**
 * Validates Set Initial Password Request Body
 * Requires newPassword and confirmPassword
 * Enforces:
 * - newPassword === confirmPassword
 * - minimum length 8 characters
 * - at least one letter and one number
 * - cannot be any default unified password (Student@2026, Teacher@2026)
 */
export const setInitialPasswordSchema = (req) => {
  const { newPassword, confirmPassword } = req?.body || req || {};
  const errors = [];

  if (!newPassword || typeof newPassword !== 'string') {
    errors.push({
      field: 'newPassword',
      message: 'New password is required',
    });
  } else {
    if (newPassword.length < 8) {
      errors.push({
        field: 'newPassword',
        message: 'New password must be at least 8 characters long',
      });
    } else if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      errors.push({
        field: 'newPassword',
        message: 'New password must contain at least one letter and one number',
      });
    }

    if (FORBIDDEN_DEFAULT_PASSWORDS.includes(newPassword.trim())) {
      errors.push({
        field: 'newPassword',
        message: 'Cannot reuse the default initial password. Please choose a unique personal password',
      });
    }
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
