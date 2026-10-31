import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AuthService {
  /**
   * Helper: Sign Standard Full JWT Token (Expires in 7 days by default)
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

  /**
   * Profile inclusion configuration for student and teacher relations
   */
  static get userProfileIncludes() {
    return {
      studentProfile: {
        include: {
          class: {
            select: { id: true, name: true, displayNameArabic: true, gradeLevel: true },
          },
        },
      },
      teacherProfile: {
        include: {
          subjects: true,
          classes: true,
        },
      },
    };
  }

  /**
   * Unified Login Endpoint Logic
   * Accepts { identifier, password }
   * - Queries prisma.user where email, nationalId, or studentCode matches
   * - Verifies bcrypt password
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

    // 1. Primary lookup: query prisma.user by email, nationalId, or studentCode
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedIdentifier.toLowerCase() },
          { nationalId: trimmedIdentifier },
          { studentCode: trimmedIdentifier },
        ],
      },
      include: this.userProfileIncludes,
    });

    // 2. Resilient Fallback: If not found in User directly, lookup via Student or Teacher relation
    if (!user) {
      const student = await prisma.student.findFirst({
        where: {
          OR: [
            { studentCode: trimmedIdentifier },
            { nationalId: trimmedIdentifier },
          ],
        },
        include: {
          user: {
            include: this.userProfileIncludes,
          },
        },
      });

      if (student && student.user) {
        user = student.user;
      }
    }

    if (!user) {
      const teacher = await prisma.teacher.findFirst({
        where: {
          OR: [
            { nationalId: trimmedIdentifier },
            { teacherCode: trimmedIdentifier },
          ],
        },
        include: {
          user: {
            include: this.userProfileIncludes,
          },
        },
      });

      if (teacher && teacher.user) {
        user = teacher.user;
      }
    }

    // 3. User verification
    if (!user) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    // 4. Password verification - before the status check, so a suspended account
    // is only revealed to someone who knows its password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('تم تجميد أو تعطيل هذا الحساب. يرجى التواصل مع إدارة النظام.');
    }

    const resolvedProfile = user.studentProfile || user.teacherProfile || null;

    // 5. Flow Differentiation: First-time login requiring password change
    if (user.forcePasswordChange === true) {
      const tempToken = this.signTempToken({ id: user.id, role: user.role });

      return {
        status: 'success',
        requirePasswordChange: true,
        tempToken,
        message: 'يرجى تعيين كلمة مرور جديدة لتفعيل الحساب',
        user: {
          id: user.id,
          fullName: user.fullName || user.name,
          role: user.role,
        },
      };
    }

    // 6. Standard Login Flow
    const token = this.signToken({ id: user.id, role: user.role }, '7d');

    return {
      status: 'success',
      requirePasswordChange: false,
      token,
      user: {
        id: user.id,
        fullName: user.fullName || user.name,
        email: user.email,
        nationalId: user.nationalId,
        studentCode: user.studentCode,
        role: user.role,
        status: user.status,
        permissions: user.permissions || [],
        profile: resolvedProfile,
      },
    };
  }

  /**
   * Set Initial Password
   * Updates password, sets forcePasswordChange = false, returns standard full JWT
   *
   * @param {string} userId
   * @param {string} newPassword
   */
  static async setInitialPassword(userId, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: this.userProfileIncludes,
    });

    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    if (!user.forcePasswordChange) {
      throw AppError.badRequest('تم تفعيل الحساب وتعيين كلمة المرور مسبقاً');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        forcePasswordChange: false,
      },
      include: this.userProfileIncludes,
    });

    const token = this.signToken({ id: updatedUser.id, role: updatedUser.role }, '7d');
    const resolvedProfile = updatedUser.studentProfile || updatedUser.teacherProfile || null;

    return {
      status: 'success',
      message: 'تم تحديث كلمة المرور وتفعيل الحساب بنجاح',
      token,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.fullName || updatedUser.name,
        email: updatedUser.email,
        nationalId: updatedUser.nationalId,
        studentCode: updatedUser.studentCode,
        role: updatedUser.role,
        status: updatedUser.status,
        permissions: updatedUser.permissions || [],
        profile: resolvedProfile,
      },
    };
  }

  /**
   * Session Introspection: Get Current Authenticated User Session
   *
   * @param {string} userId
   */
  static async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: this.userProfileIncludes,
    });

    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    const resolvedProfile = user.studentProfile || user.teacherProfile || null;

    return {
      id: user.id,
      fullName: user.fullName || user.name,
      email: user.email,
      nationalId: user.nationalId,
      studentCode: user.studentCode,
      role: user.role,
      status: user.status,
      permissions: user.permissions || [],
      phone: user.phone,
      jobTitle: user.jobTitle,
      profile: resolvedProfile,
    };
  }

  /**
   * Update Own Profile (school administration accounts)
   * Changing the login identifiers (national ID / email) requires the current password,
   * so an unattended open session can't take the account over.
   *
   * @param {string} userId
   * @param {Object} data { fullName?, nationalId?, email?, phone?, jobTitle?, currentPassword? }
   */
  static async updateProfile(userId, data) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
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

      const conditions = [];
      if (nationalIdChanged) conditions.push({ nationalId });
      if (emailChanged && email) conditions.push({ email });
      if (conditions.length) {
        const existing = await prisma.user.findFirst({
          where: { OR: conditions, NOT: { id: userId } },
          select: { nationalId: true },
        });
        if (existing) {
          throw AppError.conflict(
            nationalIdChanged && existing.nationalId === nationalId
              ? 'الرقم القومي مسجل بالفعل لمستخدم آخر'
              : 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر'
          );
        }
      }
    }

    // A sign-in identifier must remain: national ID or email
    if ((nationalIdChanged ? nationalId : user.nationalId) === null && (emailChanged ? email : user.email) === null) {
      throw AppError.badRequest('يجب أن يبقى للحساب رقم قومي أو بريد إلكتروني لتسجيل الدخول');
    }

    const fullName = data.fullName?.trim();
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && { fullName, name: fullName }),
        ...(nationalIdChanged && { nationalId }),
        ...(emailChanged && { email }),
        phone: optionalText(data.phone),
        jobTitle: optionalText(data.jobTitle),
      },
    });

    return this.getCurrentUser(userId);
  }

  /**
   * Change Own Password (needs the current one)
   *
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw AppError.badRequest('كلمة المرور الحالية غير صحيحة');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, forcePasswordChange: false },
    });

    return { status: 'success', message: 'تم تغيير كلمة المرور بنجاح' };
  }

  /**
   * Alias for getCurrentUser
   */
  static async getMe(userId) {
    return this.getCurrentUser(userId);
  }
}

export default AuthService;
