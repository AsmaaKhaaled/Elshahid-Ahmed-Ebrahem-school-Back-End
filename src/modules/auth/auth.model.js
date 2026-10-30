import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';

export class AuthModel {
  static async findByIdentifier(identifier) {
    const trimmed = identifier.trim();
    return prisma.user.findFirst({
      where: {
        OR: [
          { identifier: trimmed },
          { email: trimmed.toLowerCase() },
        ],
      },
    });
  }

  static async findByEmail(email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  static async findById(id) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async updatePassword(id, hashedPassword) {
    return prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        forcePasswordChange: false,
      },
    });
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

export default AuthModel;
