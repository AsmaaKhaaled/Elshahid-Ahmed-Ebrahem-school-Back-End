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

const NATIONAL_ID_REGEX = /^\d{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EGYPT_MOBILE_REGEX = /^01[0125]\d{8}$/;

/**
 * Validates Own Profile Update Request (PATCH /auth/me)
 * Body (any of): { fullName, nationalId, email, phone, jobTitle, currentPassword }
 * Changing nationalId or email (the login identifiers) also needs currentPassword - checked in the service.
 */
export const updateProfileSchema = (req) => {
  const { fullName, nationalId, email, phone, jobTitle, currentPassword } = req?.body || {};
  const errors = [];
  const editable = { fullName, nationalId, email, phone, jobTitle };

  if (Object.values(editable).every((value) => value === undefined)) {
    errors.push({ field: 'body', message: `Provide at least one of: [${Object.keys(editable).join(', ')}]` });
  }

  if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length < 3)) {
    errors.push({ field: 'fullName', message: 'Full name must be at least 3 characters long' });
  }

  if (nationalId !== undefined && (typeof nationalId !== 'string' || !NATIONAL_ID_REGEX.test(nationalId.trim()))) {
    errors.push({ field: 'nationalId', message: 'National ID must be a valid 14-digit number' });
  }

  if (email !== undefined && email !== null && email !== '' && (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()))) {
    errors.push({ field: 'email', message: 'Email address is not valid' });
  }

  if (phone !== undefined && phone !== null && phone !== '' && (typeof phone !== 'string' || !EGYPT_MOBILE_REGEX.test(phone.trim()))) {
    errors.push({ field: 'phone', message: 'Phone must be a valid 11-digit Egyptian mobile number' });
  }

  if (jobTitle !== undefined && jobTitle !== null && typeof jobTitle !== 'string') {
    errors.push({ field: 'jobTitle', message: 'Job title must be a string' });
  }

  if (currentPassword !== undefined && typeof currentPassword !== 'string') {
    errors.push({ field: 'currentPassword', message: 'Current password must be a string' });
  }

  if (errors.length > 0) {
    return { message: 'Validation failed', details: errors };
  }
  return null;
};

/**
 * Validates Change Password Request (PATCH /auth/change-password)
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export const changePasswordSchema = (req) => {
  const { currentPassword, newPassword, confirmPassword } = req?.body || {};
  const errors = [];

  if (!currentPassword || typeof currentPassword !== 'string') {
    errors.push({ field: 'currentPassword', message: 'Current password is required' });
  }

  if (!newPassword || typeof newPassword !== 'string' || !PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
    errors.push({ field: 'newPassword', message: 'New password must be at least 8 characters and contain letters and numbers' });
  } else if (FORBIDDEN_DEFAULT_PASSWORDS.includes(newPassword.trim())) {
    errors.push({ field: 'newPassword', message: 'Cannot reuse a default initial password' });
  } else if (newPassword === currentPassword) {
    errors.push({ field: 'newPassword', message: 'New password must be different from the current one' });
  }

  if (newPassword !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
  }

  if (errors.length > 0) {
    return { message: 'Validation failed', details: errors };
  }
  return null;
};

export const authValidation = {
  login: loginSchema,
  setInitialPassword: setInitialPasswordSchema,
  updateProfile: updateProfileSchema,
  changePassword: changePasswordSchema,
  loginSchema,
  setInitialPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
};

export default authValidation;
