'use strict';

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const env = require('../config/env');

/**
 * Helmet مع إعدادات متوافقة مع واجهة HTML/CSS/JS بسيطة.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://www.gstatic.com',
        'https://apis.google.com',
        'https://cdn.jsdelivr.net',
        "'unsafe-inline'",
      ],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: [
        "'self'",
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://firestore.googleapis.com',
      ],
      frameSrc: ["'self'", 'https://university-housing.firebaseapp.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * Rate limiter عام لكل الـ API.
 * validate: { xForwardedForHeader: false } — لمنع خطأ Vercel 500
 */
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false, // 👈 الحل
  },
  message: {
    success: false,
    message: 'عدد الطلبات كبير جدًا. حاول لاحقًا.',
  },
});

/**
 * Rate limiter أكثر تشديدًا لعمليات المصادقة.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false, // 👈 الحل
  },
  message: {
    success: false,
    message: 'محاولات دخول كثيرة. حاول بعد 15 دقيقة.',
  },
});

/**
 * إعداد CORS.
 */
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.cors.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: الأصل غير مسموح'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

module.exports = {
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  corsMiddleware,
};
