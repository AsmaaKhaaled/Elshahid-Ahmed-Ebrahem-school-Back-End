import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  assertIdentityFree,
  findAccount,
  findAccountByIdentifier,
  setAccountPassword,
  toUserResponse,
} from './accounts.js';

export class AuthService {
  /**
   * Helper: Sign Standard Full JWT Token (Expires in 7 days by default)
   * The role tells which table the id is in (users / teachers / students).
   * @param {Object} payload
   * @param {string} [expiresIn='7d']
   * @returns {string} JWT Token
   */
  static signToken(payload, expiresIn = '7d') {
    return jwt.sign(
      {
        id: payload.id,
        role: payload.role,
        isTemp: payload.isTemp || false,
      },
      env.JWT_SECRET,
      { expiresIn }
    );
  }

  /**
   * Alias for signing standard token
   */
  static signStandardToken(payload) {
    return this.signToken(payload, '7d');
  }

  /**
   * Helper: Sign Temporary Restricted JWT Token (Expires in 15 minutes)
   * @param {Object} payload
   * @returns {string} Temporary JWT Token
   */
  static signTempToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        role: payload.role,
        isTemp: true,
      },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  // ---- Student first sign-in: national ID + the school's student code (until they choose a password) ----

  static isFirstStudentLogin(account) {
    return account.role === 'STUDENT' && account.forcePasswordChange === true;
  }

  /** Codes are compared ignoring case and spaces around them (e.g. "stu-2026-001" = "STU-2026-001"). */
  static matchesStudentCode(value, account) {
    const code = (account.studentCode || '').trim();
    return Boolean(code) && typeof value === 'string' && value.trim().toUpperCase() === code.toUpperCase();
  }

  static async passwordMatches(password, account) {
    return Boolean(account.password) && bcrypt.compare(password, account.password);
  }

  /**
   * Unified Login Endpoint Logic
   * Accepts { identifier, password }
   * - Finds the account: an admin (users), a teacher or a student, by national ID / email / code
   * - Verifies bcrypt password (a student's first sign-in: national ID + student code instead)
   * - Verifies status === 'ACTIVE'
   * - Checks forcePasswordChange:
   *     If true: returns tempToken (15m) and restricted payload
   *     If false: returns standard token (7d) and loaded profile
   *
   * @param {string|Object} identifierOrBody
   * @param {string} [passwordArg]
   */
  static async login(identifierOrBody, passwordArg) {
    const identifier =
      typeof identifierOrBody === 'object' && identifierOrBody !== null
        ? identifierOrBody.identifier
        : identifierOrBody;
    const password =
      typeof identifierOrBody === 'object' && identifierOrBody !== null
        ? identifierOrBody.password
        : passwordArg;

    if (!identifier || !password) {
      throw AppError.badRequest('Identifier and password are required');
    }

    const trimmedIdentifier = identifier.trim();

    // 1. The account behind the identifier, whichever table it is in
    const account = await findAccountByIdentifier(trimmedIdentifier, { withPassword: true, withProfile: true });
    if (!account) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    // 2. Password verification - before the status check, so a suspended account
    // is only revealed to someone who knows its password.
    // A student who hasn't chosen a password yet signs in with their national ID + school code.
    const isPasswordValid = this.isFirstStudentLogin(account)
      ? trimmedIdentifier === account.nationalId && this.matchesStudentCode(password, account)
      : await this.passwordMatches(password, account);
    if (!isPasswordValid) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    if (account.status !== 'ACTIVE') {
      throw AppError.forbidden('تم تجميد أو تعطيل هذا الحساب. يرجى التواصل مع إدارة النظام.');
    }

    // 3. Flow Differentiation: First-time login requiring password change
    if (account.forcePasswordChange === true) {
      const tempToken = this.signTempToken({ id: account.id, role: account.role });

      return {
        status: 'success',
        requirePasswordChange: true,
        tempToken,
        message: 'يرجى تعيين كلمة مرور جديدة لتفعيل الحساب',
        user: {
          id: account.id,
          fullName: account.fullName,
          role: account.role,
        },
      };
    }

    // 4. Standard Login Flow
    const token = this.signToken({ id: account.id, role: account.role }, '7d');
    const { phone, jobTitle, ...user } = toUserResponse(account);

    return {
      status: 'success',
      requirePasswordChange: false,
      token,
      user,
    };
  }

  /**
   * Set Initial Password
   * Updates password, sets forcePasswordChange = false, returns standard full JWT
   *
   * @param {Object} sessionUser req.user (from the temporary token)
   * @param {string} newPassword
   */
  static async setInitialPassword(sessionUser, newPassword) {
    const account = await findAccount(sessionUser.role, sessionUser.id, { withProfile: true });

    if (!account) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    if (!account.forcePasswordChange) {
      throw AppError.badRequest('تم تفعيل الحساب وتعيين كلمة المرور مسبقاً');
    }

    // The code is printed on the student's card, so it can't become their password
    if (account.role === 'STUDENT' && this.matchesStudentCode(newPassword, account)) {
      throw AppError.badRequest('لا يمكن استخدام كود الطالب ككلمة مرور، يرجى اختيار كلمة مرور خاصة بك');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await setAccountPassword(account, hashedPassword);

    const token = this.signToken({ id: account.id, role: account.role }, '7d');
    const { phone, jobTitle, ...user } = toUserResponse(account);

    return {
      status: 'success',
      message: 'تم تحديث كلمة المرور وتفعيل الحساب بنجاح',
      token,
      user,
    };
  }

  /**
   * Session Introspection: Get Current Authenticated User Session
   *
   * @param {Object} sessionUser req.user
   */
  static async getCurrentUser(sessionUser) {
    const account = await findAccount(sessionUser.role, sessionUser.id, { withProfile: true });

    if (!account) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    return toUserResponse(account);
  }

  /**
   * Update Own Profile (school administration accounts, in "users")
   * Changing the login identifiers (national ID / email) requires the current password,
   * so an unattended open session can't take the account over.
   *
   * @param {Object} sessionUser req.user
   * @param {Object} data { fullName?, nationalId?, email?, phone?, jobTitle?, currentPassword? }
   */
  static async updateProfile(sessionUser, data) {
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    const optionalText = (value) => {
      if (value === undefined) return undefined;
      const trimmed = typeof value === 'string' ? value.trim() : '';
      return trimmed || null;
    };

    const nationalId = data.nationalId?.trim();
    const email = data.email === undefined ? undefined : optionalText(data.email)?.toLowerCase() ?? null;
    const nationalIdChanged = nationalId !== undefined && nationalId !== user.nationalId;
    const emailChanged = email !== undefined && email !== user.email;

    if (nationalIdChanged || emailChanged) {
      const isPasswordValid = data.currentPassword && (await bcrypt.compare(data.currentPassword, user.password));
      if (!isPasswordValid) {
        throw AppError.badRequest('كلمة المرور الحالية غير صحيحة');
      }

      // Not taken by any other account: admin, teacher or student
      await assertIdentityFree(
        { nationalId: nationalIdChanged ? nationalId : null, email: emailChanged ? email : null },
        { model: 'user', id: user.id }
      );
    }

    // A sign-in identifier must remain: national ID or email
    if ((nationalIdChanged ? nationalId : user.nationalId) === null && (emailChanged ? email : user.email) === null) {
      throw AppError.badRequest('يجب أن يبقى للحساب رقم قومي أو بريد إلكتروني لتسجيل الدخول');
    }

    const fullName = data.fullName?.trim();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(fullName && { fullName, name: fullName }),
        ...(nationalIdChanged && { nationalId }),
        ...(emailChanged && { email }),
        phone: optionalText(data.phone),
        jobTitle: optionalText(data.jobTitle),
      },
    });

    return this.getCurrentUser(sessionUser);
  }

  /**
   * Change Own Password (needs the current one)
   *
   * @param {Object} sessionUser req.user
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  static async changePassword(sessionUser, currentPassword, newPassword) {
    const account = await findAccount(sessionUser.role, sessionUser.id, { withPassword: true });
    if (!account) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    const isPasswordValid = await this.passwordMatches(currentPassword, account);
    if (!isPasswordValid) {
      throw AppError.badRequest('كلمة المرور الحالية غير صحيحة');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await setAccountPassword(account, hashedPassword);

    return { status: 'success', message: 'تم تغيير كلمة المرور بنجاح' };
  }

  /**
   * Alias for getCurrentUser
   */
  static async getMe(sessionUser) {
    return this.getCurrentUser(sessionUser);
  }
}

export default AuthService;
