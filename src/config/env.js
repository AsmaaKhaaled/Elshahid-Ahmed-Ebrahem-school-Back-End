import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const INSECURE_DEFAULT_SECRET = 'super_secret_school_jwt_key_2026';
const INSECURE_DEFAULT_REFRESH_SECRET = 'super_secret_school_refresh_jwt_key_2026';

// Fail-safe validation for production security
if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === INSECURE_DEFAULT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
      'FATAL SECURITY ERROR: JWT_SECRET must be configured in environment variables, cannot use default value, and must be at least 32 characters long in production mode.'
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL CONFIG ERROR: DATABASE_URL must be defined in production.');
  }
}

export const env = {
  NODE_ENV,
  isProduction,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:4200',
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_POOLED: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || INSECURE_DEFAULT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || INSECURE_DEFAULT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  // Where uploaded files (curricula...) are kept on the server
  UPLOAD_DIR: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
};

export default env;
