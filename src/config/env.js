import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:4200',
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_POOLED: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_school_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super_secret_school_refresh_jwt_key_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};

export default env;
