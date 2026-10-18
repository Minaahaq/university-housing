'use strict';

const { db } = require('../config/firebase');
const logger = require('./logger');

/**
 * يسجل عملية حساسة في auditLogs.
 * لا يوقف العملية إن فشل التسجيل (fire-and-forget).
 */
async function logAction({ userId, action, targetType, targetId, details = null, req = null }) {
  try {
    await db.collection('auditLogs').add({
      userId: userId || null,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      details: details || null,
      ip: req ? (req.ip || req.connection?.remoteAddress || null) : null,
      userAgent: req ? (req.headers['user-agent'] || null) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('فشل تسجيل auditLog', { action, error: err.message });
  }
}

module.exports = { logAction };
