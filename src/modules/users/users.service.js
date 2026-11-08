import { UserModel } from './users.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { AuthService } from '../auth/auth.service.js';
import { assertIdentityFree } from '../auth/accounts.js';

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

  /** Any signed-in account (admin, teacher or student): same as GET /auth/me */
  static async getMe(sessionUser) {
    return AuthService.getCurrentUser(sessionUser);
  }

  /** Any signed-in account: same as PATCH /auth/change-password */
  static async changePassword(sessionUser, { currentPassword, newPassword }) {
    return AuthService.changePassword(sessionUser, currentPassword, newPassword);
  }

  static async createUser(data) {
    // Not taken by any account: admin, teacher or student
    await assertIdentityFree({ nationalId: data.nationalId, email: data.email?.toLowerCase() });
    return UserModel.create(data);
  }

  static async updateUser(id, data) {
    await assertIdentityFree({ nationalId: data.nationalId, email: data.email?.toLowerCase() }, { model: 'user', id });
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
