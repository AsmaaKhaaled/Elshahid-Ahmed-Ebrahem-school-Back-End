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
      createdAt: true,
      updatedAt: true,
    };
  }

  /**
   * Get all Sub-Admins
   */
  static async getAllAdmins(query = {}) {
    const where = { role: 'ADMIN' };

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

    return prisma.user.findMany({
      where,
      select: this.adminSelectFields,
      orderBy: { createdAt: 'desc' },
    });
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
    const email = data.email.trim().toLowerCase();
    const nationalId = data.nationalId.trim();

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { nationalId }],
      },
    });

    if (existing) {
      if (existing.email === email) {
        throw AppError.conflict('البريد الإلكتروني مسجل بالفعل لمستخدم آخر');
      }
      if (existing.nationalId === nationalId) {
        throw AppError.conflict('الرقم القومي مسجل بالفعل لمستخدم آخر');
      }
    }

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
        phone: data.phone?.trim() || null,
      },
      select: this.adminSelectFields,
    });

    return newAdmin;
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

