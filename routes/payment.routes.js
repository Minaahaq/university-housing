'use strict';

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');
const ctrl = require('../controllers/payment.controller');

const router = express.Router();
const guard = requirePermission('payments.manage');

const createRules = [
  body('studentId').isString().notEmpty().withMessage('الطالب مطلوب'),
  body('month').isString().notEmpty().withMessage('الشهر مطلوب'),
  body('due').isNumeric().withMessage('المطلوب رقم'),
  body('paid').isNumeric().withMessage('المدفوع رقم'),
];

router.get('/', authenticate, guard, ctrl.list);
router.get('/:id', authenticate, guard, ctrl.getOne);
router.post('/', authenticate, guard, createRules, validate, ctrl.create);
router.delete('/:id', authenticate, guard, ctrl.remove);

module.exports = router;
