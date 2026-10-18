'use strict';

const { db, auth } = require('../config/firebase');
const userService = require('../services/user.service');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * GET /api/auth/me
 */
async function me(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
        fullName: req.user.fullName,
        status: req.user.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register-profile
 * يُنشئ ملف المستخدم في Firestore إن لم يكن موجودًا.
 * لا يسمح بتغيير الدور أو الصلاحيات.
 */
async function registerProfile(req, res, next) {
  try {
    const { uid, email } = req.user;
    const { fullName, phone } = req.body;

    const existing = await userService.getUserById(uid);
    if (existing) {
      throw ApiError.conflict('ملف المستخدم موجود مسبقًا');
    }

    const created = await userService.createUserProfile({
      uid,
      email,
      fullName,
      phone: phone || null,
      role: 'employee',
      permissions: [],
      status: 'pending',
    });

    logger.info('تم إنشاء ملف مستخدم جديد', { uid, email });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الملف. حسابك بانتظار اعتماد المدير.',
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/auth/profile
 * يحدّث fullName و phone فقط — لا يسمح بتغيير role/permissions.
 */
async function updateProfile(req, res, next) {
  try {
    const { fullName, phone } = req.body;

    if (!fullName || fullName.trim().length < 3) {
      throw ApiError.badRequest('الاسم الكامل مطلوب (3 أحرف على الأقل)');
    }

    const patch = {
      fullName: fullName.trim(),
      phone: phone ? String(phone).trim() : null,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('users').doc(req.user.uid).update(patch);

    logger.info('تحديث الملف الشخصي', { uid: req.user.uid });

    res.json({
      success: true,
      data: {
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
        status: req.user.status,
        fullName: patch.fullName,
        phone: patch.phone,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/auth/sessions
 * يلغي جميع refresh tokens للمستخدم الحالي.
 */
async function revokeSessions(req, res, next) {
  try {
    await auth.revokeRefreshTokens(req.user.uid);
    logger.info('إلغاء جميع الجلسات', { uid: req.user.uid });
    res.json({ success: true, message: 'تم إلغاء جميع الجلسات' });
  } catch (err) {
    next(err);
  }
}

module.exports = { me, registerProfile, updateProfile, revokeSessions };
