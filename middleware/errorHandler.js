'use strict';

const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound('المسار غير موجود: ' + req.method + ' ' + req.originalUrl));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  if (!isOperational) {
    logger.error('خطأ غير متوقع', {
      message: err.message,
      stack: env.isProd ? undefined : err.stack,
      path: req.originalUrl,
      method: req.method,
      uid: req.user && req.user.uid ? req.user.uid : null,
    });
  } else {
    logger.warn('خطأ تشغيلي', {
      message: err.message,
      statusCode: statusCode,
      path: req.originalUrl,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? err.messageAr : 'حدث خطأ غير متوقع في الخادم',
    ...(err.details ? { details: err.details } : {}),
    ...(env.isProd ? {} : { debug: err.message }),
  });
}

module.exports = { notFoundHandler, errorHandler };
