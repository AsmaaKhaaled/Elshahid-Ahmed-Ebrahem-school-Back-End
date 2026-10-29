import { AuthModel } from './auth.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/token.util.js';

export class AuthService {
  static async register({ name, email, password, role }) {
    const existingUser = await AuthModel.findByEmail(email);
    if (existingUser) {
      throw AppError.conflict('An account with this email already exists');
    }

    const user = await AuthModel.create({ name, email, password, role });

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      tokens: { accessToken, refreshToken },
    };
  }

  static async login({ email, password }) {
    const user = await AuthModel.findByEmail(email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isMatch = await AuthModel.verifyPassword(password, user.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw AppError.forbidden('Your account has been deactivated. Please contact admin.');
    }

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      tokens: { accessToken, refreshToken },
    };
  }

  static async refreshToken(refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await AuthModel.findById(decoded.id);

      if (!user || !user.isActive) {
        throw AppError.unauthorized('User not found or deactivated');
      }

      const tokenPayload = { id: user.id, email: user.email, role: user.role };
      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }
  }

  static async getCurrentUser(userId) {
    const user = await AuthModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export default AuthService;

