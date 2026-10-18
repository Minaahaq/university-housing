'use strict';

require('dotenv').config();

const required = ['FIREBASE_PROJECT_ID'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ متغير البيئة المطلوب غير موجود: ${key}`);
    process.exit(1);
  }
}

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!serviceAccountPath && !serviceAccountJson) {
  console.error(
    '❌ أضف FIREBASE_SERVICE_ACCOUNT_PATH أو FIREBASE_SERVICE_ACCOUNT_JSON'
  );
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountPath,
    serviceAccountJson,
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

module.exports = env;
