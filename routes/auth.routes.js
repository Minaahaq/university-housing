'use strict';

const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/**
 * GET /api/auth/me
 * يعيد بيانات المستخدم الحالي بناءً على Firebase ID Token.
 */
router.get('/me', authenticate, authController.me);

/**
 * POST /api/auth/register-profile
 * يُستخدم بعد إنشاء الحساب في Firebase Auth لإنشاء ملف المستخدم في Firestore.
 */
router.post(
  '/register-profile',
  authenticate,
  [
    body('fullName').trim().isLength({ min: 3, max: 100 })
      .withMessage('الاسم الكامل مطلوب (3-100 حرف)'),
    body('phone').optional().trim().isLength({ max: 20 })
      .withMessage('رقم الهاتف غير صالح'),
  ],
  validate,
  authController.registerProfile
);

/**
 * PUT /api/auth/profile
 * تحديث الاسم والهاتف فقط.
 */
router.put(
  '/profile',
  authenticate,
  [
    body('fullName').trim().isLength({ min: 3, max: 100 })
      .withMessage('الاسم الكامل مطلوب (3-100 حرف)'),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
  ],
  validate,
  authController.updateProfile
);

/**
 * DELETE /api/auth/sessions
 * إلغاء جميع جلسات المستخدم.
 */
router.delete('/sessions', authenticate, authController.revokeSessions);

module.exports = router;
