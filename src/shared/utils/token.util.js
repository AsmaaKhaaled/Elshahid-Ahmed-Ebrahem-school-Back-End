import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

/**
 * Generate Access Token
 * @param {Object} payload
 * @returns {string} JWT Token
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

/**
 * Generate Standard Token (7 days)
 * @param {Object} payload
 * @returns {string} JWT Token
 */
export const signStandardToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      isTemp: false,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Generate Temporary Token (15 minutes)
 * @param {Object} payload
 * @returns {string} JWT Token
 */
export const signTempToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      isTemp: true,
    },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

/**
 * Generate Refresh Token
 * @param {Object} payload
 * @returns {string} JWT Refresh Token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Verify Access Token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

/**
 * Verify Refresh Token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};

export default {
  generateAccessToken,
  generateRefreshToken,
  signStandardToken,
  signTempToken,
  verifyAccessToken,
  verifyRefreshToken,
};

