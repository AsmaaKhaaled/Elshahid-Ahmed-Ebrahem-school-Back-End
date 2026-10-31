import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AdminService {
  /**
   * Fields selected when returning Admin profiles (omits password)
   */
  static get adminSelectFields() {
    return {
      id: true,
      fullName: true,
      email: true,
      nationalId: true,
      role: true,
      status: true,
      permissions: true,
      phone: true,
      jobTitle: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  /**
   * Optional text fields: '' or null clears them, undefined leaves them as they are
   */
  static optionalText(value) {
    if (value === undefined) return undefined;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || null;
  }

  /**
   * Throws 409 when the national ID or email already belongs to another user
   */
  static async assertUniqueIdentity({ nationalId, email }, exceptId) {
    const conditions = [];
    if (nationalId) conditions.push({ nationalId });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return;

    const existing = await prisma.user.findFirst({
      where: {
        OR: conditions,
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { nationalId: true, email: true },
    });

    if (!existing) return;
    if (nationalId && existing.nationalId === nationalId) {
      throw AppError.conflict('الرقم القومي مسجل بالفعل لمستخدم آخر');
    }
    throw AppError.conflict('البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
  }

  /**
   * Get all school administration accounts (the Super Admin first, then Sub-Admins)
   */
  static async getAllAdmins(query = {}) {
    const where = { role: { in: ['SUPER_ADMIN', 'ADMIN'] } };

    if (query.status) {
      where.status = query.status.toUpperCase();
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const admins = await prisma.user.findMany({
      where,
      select: { ...this.adminSelectFields, name: true },
      orderBy: { createdAt: 'desc' },
    });

    // Sorted here: SUPER_ADMIN was appended to the Role enum, so the DB orders it last
    return admins
      .map(({ name, ...admin }) => ({ ...admin, fullName: admin.fullName || name || '' }))
      .sort((a, b) => (b.role === 'SUPER_ADMIN') - (a.role === 'SUPER_ADMIN'));
  }

  /**
   * Get single Admin by ID
   */
  static async getAdminById(id) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
      select: this.adminSelectFields,
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    return admin;
  }

  /**
   * Create a new Sub-Admin
   */
  static async createAdmin(data) {
    // Email is optional - admins sign in with their national ID
    const email = this.optionalText(data.email)?.toLowerCase() ?? null;
    const nationalId = data.nationalId.trim();

    await this.assertUniqueIdentity({ nationalId, email });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const newAdmin = await prisma.user.create({
      data: {
        fullName: data.fullName.trim(),
        name: data.fullName.trim(),
        email,
        nationalId,
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
        forcePasswordChange: false,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        phone: this.optionalText(data.phone) ?? null,
        jobTitle: this.optionalText(data.jobTitle) ?? null,
      },
      select: this.adminSelectFields,
    });

    return newAdmin;
  }

  /**
   * Update Sub-Admin profile (name, national ID, email, phone, job title)
   */
  static async updateAdmin(id, data) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    const nationalId = data.nationalId?.trim();
    const email = this.optionalText(data.email)?.toLowerCase();

    await this.assertUniqueIdentity({ nationalId, email }, id);

    const fullName = data.fullName?.trim();
    return prisma.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName, name: fullName }),
        ...(nationalId && { nationalId }),
        ...(data.email !== undefined && { email: email ?? null }),
        phone: this.optionalText(data.phone),
        jobTitle: this.optionalText(data.jobTitle),
      },
      select: this.adminSelectFields,
    });
  }

  /**
   * Update Sub-Admin Permissions Matrix
   */
  static async updatePermissions(id, permissions) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    return prisma.user.update({
      where: { id },
      data: {
        permissions: Array.isArray(permissions) ? permissions : [],
      },
      select: this.adminSelectFields,
    });
  }

  /**
   * Update Sub-Admin Account Status (ACTIVE | SUSPENDED)
   */
  static async updateStatus(id, status) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    return prisma.user.update({
      where: { id },
      data: {
        status: status.toUpperCase(),
      },
      select: this.adminSelectFields,
    });
  }

  /**
   * Reset Sub-Admin Password by Super Admin
   */
  static async resetPassword(id, newPassword) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message: 'تمت إعادة تعيين كلمة مرور المسؤول بنجاح',
    };
  }

  /**
   * Delete Sub-Admin Account
   */
  static async deleteAdmin(id) {
    const admin = await prisma.user.findFirst({
      where: { id, role: 'ADMIN' },
    });

    if (!admin) {
      throw AppError.notFound(`المسؤول ذو المعرف '${id}' غير موجود`);
    }

    await prisma.user.delete({
      where: { id },
    });

    return {
      message: 'تم حذف حساب المسؤول بنجاح',
    };
  }
}

export default AdminService;

