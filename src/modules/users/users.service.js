import bcrypt from 'bcryptjs';
import { UserModel } from './users.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class UsersService {
  static async getUsers(query) {
    return UserModel.findAll(query);
  }

  static async getUserById(id) {
    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound(`User with id '${id}' not found`);
    }
    return user;
  }

  static async getMe(id) {
    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User profile not found');
    }
    return user;
  }

  static async changePassword(id, { currentPassword, newPassword }) {
    const userWithPassword = await UserModel.findByIdWithPassword(id);
    if (!userWithPassword) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password);
    if (!isMatch) {
      throw AppError.badRequest('Current password does not match');
    }

    const updatedUser = await UserModel.changePassword(id, newPassword);
    return updatedUser;
  }

  static async createUser(data) {
    const existing = await UserModel.findByEmail(data.email);
    if (existing) {
      throw AppError.conflict('User with this email already exists');
    }
    return UserModel.create(data);
  }

  static async updateUser(id, data) {
    if (data.email) {
      const existing = await UserModel.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw AppError.conflict('Email is already taken by another user');
      }
    }
    const updated = await UserModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`User with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteUser(id) {
    const deleted = await UserModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`User with id '${id}' not found`);
    }
    return true;
  }
}

export default UsersService;
