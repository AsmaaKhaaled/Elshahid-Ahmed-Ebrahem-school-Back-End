import { UsersService } from './users.service.js';
import { ApiResponse } from '../../shared/utils/api-response.js';

export class UsersController {
  static async getAll(req, res, next) {
    try {
      const users = await UsersService.getUsers(req.query);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: users,
        meta: { total: users.length },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const user = await UsersService.getUserById(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'User retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await UsersService.getMe(req.user);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'User profile retrieved successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const updatedUser = await UsersService.changePassword(req.user, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'Password changed successfully',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req, res, next) {
    try {
      const newUser = await UsersService.createUser(req.body);
      return ApiResponse.created(res, newUser, 'User created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await UsersService.updateUser(req.params.id, req.body);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'User updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await UsersService.deleteUser(req.params.id);
      return ApiResponse.success(res, {
        statusCode: 200,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default UsersController;
