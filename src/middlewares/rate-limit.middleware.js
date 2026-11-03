import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Authentication routes (/login, /set-initial-password, etc.)
 * Prevents brute-force attacks and credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'تم تجاوز الحد الأقصى من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة لحماية حسابك.',
  },
});

/**
 * General API Rate Limiter
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'تم تجاوز معدل الطلبات المسموح به. يرجى التمهل قليلاً.',
  },
});

export default {
  authLimiter,
  generalApiLimiter,
};

