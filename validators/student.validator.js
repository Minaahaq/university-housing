'use strict';

const { body, param } = require('express-validator');

function createRules() {
  return [
    body('name').trim().isLength({ min: 3, max: 100 })
      .withMessage('اسم الطالب مطلوب (3-100 حرف)'),
    body('national').optional({ nullable: true }).trim().isLength({ min: 0, max: 30 }),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail()
      .withMessage('البريد الإلكتروني غير صالح'),
    body('college').optional({ nullable: true }).trim().isLength({ max: 100 }),
    body('year').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('wing').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('floor').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('room').optional({ nullable: true }).trim().isLength({ max: 20 }),
    body('roomType').optional({ nullable: true }).trim().isLength({ max: 30 }),
    body('status').optional().isIn(['مقيم', 'مسافر', 'إجازة', 'منسحب'])
      .withMessage('حالة الطالب غير صالحة'),
    body('monthly').optional().isNumeric().withMessage('الرسوم يجب أن تكون رقمًا'),
    body('notes').optional({ nullable: true }).trim().isLength({ max: 1000 }),
  ];
}

function updateRules() {
  return [
    param('id').isString().isLength({ min: 1 }),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
    body('status').optional().isIn(['مقيم', 'مسافر', 'إجازة', 'منسحب']),
    body('monthly').optional().isNumeric(),
  ];
}

module.exports = { createRules, updateRules };
