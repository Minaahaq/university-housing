'use strict';

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');
const ctrl = require('../controllers/permit.controller');

const router = express.Router();
const guard = requirePermission('permits.manage');

const createRules = [
  body('studentId').isString().notEmpty().withMessage('الطالب مطلوب'),
  body('type').isIn(['تصريح مبيت', 'تصريح سفر', 'تصريح خروج', 'تصريح العيادة']).withMessage('نوع غير صالح'),
  body('date').isISO8601().withMessage('التاريخ غير صالح'),
];

router.get('/', authenticate, guard, ctrl.list);
router.get('/:id', authenticate, guard, ctrl.getOne);
router.post('/', authenticate, guard, createRules, validate, ctrl.create);
router.post('/:id/approve', authenticate, guard, ctrl.approve);
router.post('/:id/reject', authenticate, guard, ctrl.reject);
router.delete('/:id', authenticate, guard, ctrl.remove);

module.exports = router;
