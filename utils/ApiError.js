'use strict';

/**
 * خطأ مخصص يحمل رمز HTTP ورسالة عربية.
 */
class ApiError extends Error {
  constructor(statusCode, messageAr, details = null) {
    super(messageAr);
    this.statusCode = statusCode;
    this.messageAr = messageAr;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg = 'بيانات غير صحيحة', details = null) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'غير مصرح بالوصول') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'ليس لديك صلاحية لتنفيذ هذه العملية') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'العنصر غير موجود') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'تعارض في البيانات') {
    return new ApiError(409, msg);
  }
  static internal(msg = 'خطأ داخلي في الخادم') {
    return new ApiError(500, msg);
  }
}

module.exports = ApiError;
