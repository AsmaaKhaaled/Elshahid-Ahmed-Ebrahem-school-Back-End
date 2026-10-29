import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AuthService {
  /**
   * Helper: Sign Standard Full JWT Token (Expires in 7 days)
   * @param {Object} payload { id, role, ... }
   * @returns {string} JWT Token
   */
  static signStandardToken(payload) {
    return jwt.sign(
      {
        id: payload.id,
        role: payload.role,
        isTemp: false,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Helper: Sign Temporary Restricted JWT Token (Expires in 15 minutes)
   * @param {Object} payload { id, role, ... }
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
   * Unified Login
   * Resolves identifier against User.identifier / email, StudentProfile.studentCode, or Teacher.nationalId
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

    // 1. Resolve User
    let user = null;

    // Check directly in User model (by identifier or email)
    try {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { identifier: trimmedIdentifier },
            { email: trimmedIdentifier.toLowerCase() },
          ],
        },
        include: {
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
        },
      });
    } catch {
      // In case identifier column is pending migration, fallback to email lookup
      user = await prisma.user.findFirst({
        where: {
          email: trimmedIdentifier.toLowerCase(),
        },
        include: {
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
        },
      });
    }

    // 2. If not matched, check StudentProfile (by studentCode or nationalId)
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
            include: {
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
            },
          },
        },
      });

      if (student && student.user) {
        user = student.user;
      }
    }

    // 3. If not matched, check TeacherProfile (by nationalId or teacherCode)
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
            include: {
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
            },
          },
        },
      });

      if (teacher && teacher.user) {
        user = teacher.user;
      }
    }

    // 4. Validate existence and password
    if (!user) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    if (!user.isActive) {
      throw AppError.forbidden('تم تعطيل هذا الحساب. يرجى التواصل مع إدارة المدرسة.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة');
    }

    // 5. Determine profile data
    const profile =
      user.role === 'STUDENT'
        ? user.studentProfile
        : user.role === 'TEACHER'
        ? user.teacherProfile
        : null;

    // 6. Flow Differentiation based on forcePasswordChange
    if (user.forcePasswordChange === true) {
      const tempToken = this.signTempToken({ id: user.id, role: user.role });

      return {
        status: 'success',
        requirePasswordChange: true,
        tempToken,
        message: 'يرجى تعيين كلمة مرور جديدة لتفعيل الحساب',
      };
    }

    const token = this.signStandardToken({ id: user.id, role: user.role });

    return {
      status: 'success',
      requirePasswordChange: false,
      token,
      user: {
        id: user.id,
        fullName: user.name,
        email: user.email,
        role: user.role,
        profile,
      },
    };
  }

  /**
   * Set Initial Password (for users with forcePasswordChange === true)
   * @param {string} userId
   * @param {string} newPassword
   */
  static async setInitialPassword(userId, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    if (!user.forcePasswordChange) {
      throw AppError.badRequest('تم تفعيل الحساب وتعيين كلمة المرور مسبقاً');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    let updatedUser;
    try {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          forcePasswordChange: false,
        },
        include: {
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
        },
      });
    } catch {
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
        include: {
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
        },
      });
      updatedUser.forcePasswordChange = false;
    }

    const token = this.signStandardToken({ id: updatedUser.id, role: updatedUser.role });
    const profile =
      updatedUser.role === 'STUDENT'
        ? updatedUser.studentProfile
        : updatedUser.role === 'TEACHER'
        ? updatedUser.teacherProfile
        : null;

    return {
      status: 'success',
      message: 'تم تحديث كلمة المرور وتفعيل الحساب بنجاح',
      token,
      user: {
        id: updatedUser.id,
        fullName: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profile,
      },
    };
  }

  /**
   * Get Current Authenticated User Session
   * @param {string} userId
   */
  static async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user) {
      throw AppError.notFound('المستخدم غير موجود');
    }

    const profile =
      user.role === 'STUDENT'
        ? user.studentProfile
        : user.role === 'TEACHER'
        ? user.teacherProfile
        : null;

    return {
      id: user.id,
      fullName: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      profile,
    };
  }
}

export default AuthService;
