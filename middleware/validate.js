'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * يتحقق من نتيجة express-validator ويعيد 400 مع تفاصيل الأخطاء.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  return next(ApiError.badRequest('بيانات غير صحيحة', details));
}

module.exports = { validate };
