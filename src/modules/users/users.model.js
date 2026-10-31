import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';

export class UserModel {
  static get userSelectFields() {
    return {
      id: true,
      fullName: true,
      name: true,
      email: true,
      nationalId: true,
      studentCode: true,
      role: true,
      status: true,
      permissions: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  static async findAll({ role, search } = {}) {
    const where = {};

    if (role) {
      where.role = role.toUpperCase();
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.user.findMany({
      where,
      select: this.userSelectFields,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      select: this.userSelectFields,
    });
  }

  static async findByIdWithPassword(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  static async create(data) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    const fullName = data.fullName || data.name;

    return prisma.user.create({
      data: {
        fullName,
        name: fullName,
        email: data.email ? data.email.toLowerCase() : null,
        nationalId: data.nationalId || null,
        studentCode: data.studentCode || null,
        password: hashedPassword,
        role: data.role || 'STUDENT',
        status: data.status || 'ACTIVE',
        phone: data.phone || null,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      },
      select: this.userSelectFields,
    });
  }

  static async update(id, data) {
    const updateData = { ...data };

    if (updateData.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.password, salt);
    }

    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    if (updateData.fullName && !updateData.name) {
      updateData.name = updateData.fullName;
    } else if (updateData.name && !updateData.fullName) {
      updateData.fullName = updateData.name;
    }

    return prisma.user.update({
      where: { id },
      data: updateData,
      select: this.userSelectFields,
    });
  }

  static async changePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    return prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: this.userSelectFields,
    });
  }

  static async delete(id) {
    await prisma.user.delete({
      where: { id },
    });
    return true;
  }
}

export default UserModel;
