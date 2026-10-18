'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');

describe('Students API', () => {
  let app;
  let token;

  beforeAll(async () => {
    try {
      require('fs').accessSync('./config/serviceAccountKey.json');
    } catch {
      console.warn('تخطي اختبارات API — لا يوجد Service Account');
      return;
    }
    app = require('../server');
    // ⚠️ اختبارات API تتطلب Firebase ID Token صالح.
    // لأغراض الاختبار الكامل، استخدم اختبار تكامل مع Firebase Auth Emulator.
    token = process.env.TEST_ID_TOKEN || null;
  });

  test('GET /api/students بدون توكن يعيد 401', async () => {
    if (!app) return;
    const res = await request(app).get('/api/students');
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/students بدون توكن يعيد 401', async () => {
    if (!app) return;
    const res = await request(app).post('/api/students').send({ name: 'x' });
    expect(res.statusCode).toBe(401);
  });

  test('GET /healthz يعيد 200', async () => {
    if (!app) return;
    const res = await request(app).get('/healthz');
    expect(res.statusCode).toBe(200);
  });
});
