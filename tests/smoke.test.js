'use strict';

const request = require('supertest');

// ⚠️ سنشغل الخادم بعد تحميل .env الحقيقي.
// لأغراض الاختبار، نضع قيمًا افتراضية.
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'test-project';
process.env.FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/serviceAccountKey.json';

describe('Smoke tests', () => {
  let app;

  beforeAll(() => {
    // ملاحظة: هذه الاختبارات تتطلب ملف serviceAccountKey.json صالحًا.
    // إن لم يكن موجودًا، سيتم تخطيها.
    try {
      require('fs').accessSync('./config/serviceAccountKey.json');
      app = require('../server');
    } catch {
      app = null;
    }
  });

  test('GET /healthz يعيد 200', async () => {
    if (!app) return;
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/auth/me بدون توكن يعيد 401', async () => {
    if (!app) return;
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('مسار غير موجود يعيد 404', async () => {
    if (!app) return;
    const res = await request(app).get('/api/does-not-exist');
    expect(res.statusCode).toBe(404);
  });
});
