'use strict';

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body, param } = require('express-validator');
const ctrl = require('../controllers/worker.controller');

const router = express.Router();
const guard = requirePermission('workers.manage');

const rules = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('الاسم مطلوب (3-100 حرف)'),
  body('due').optional().isNumeric().withMessage('المستحق رقم'),
  body('paid').optional().isNumeric().withMessage('المدفوع رقم'),
];

router.get('/', authenticate, guard, ctrl.list);
router.get('/:id', authenticate, guard, param('id').isString(), validate, ctrl.getOne);
router.post('/', authenticate, guard, rules, validate, ctrl.create);
router.put('/:id', authenticate, guard, param('id').isString(), validate, ctrl.update);
router.delete('/:id', authenticate, guard, ctrl.remove);

module.exports = router;
