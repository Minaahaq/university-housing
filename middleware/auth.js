'use strict';

const { auth, db } = require('../config/firebase');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('لم يتم إرسال رمز المصادقة');
    }
    const idToken = header.slice('Bearer '.length).trim();
    if (!idToken) throw ApiError.unauthorized('رمز المصادقة فارغ');

    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken, true);
    } catch (err) {
      logger.warn('فشل التحقق من التوكن', { code: err.code });
      throw ApiError.unauthorized('رمز المصادقة غير صالح أو منتهي');
    }

    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      throw ApiError.forbidden('حسابك غير مسجل في النظام');
    }
    const userData = userDoc.data();

    if (userData.disabled === true || userData.status === 'disabled') {
      throw ApiError.forbidden('تم إيقاف حسابك. راجع الإدارة.');
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role: userData.role || 'employee',
      permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
      fullName: userData.fullName || '',
      status: userData.status || 'active',
    };

    next();
  } catch (err) {
    next(err);
  }
}

function requirePermission(...requiredPerms) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'admin') return next();
    const has = requiredPerms.some((p) => req.user.permissions.includes(p));
    if (!has) {
      return next(ApiError.forbidden('ليست لديك الصلاحية المطلوبة'));
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('هذه العملية متاحة للمدير فقط'));
    }
    next();
  };
}

module.exports = { authenticate, requirePermission, requireRole };
