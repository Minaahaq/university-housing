'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');
const ctrl = require('../controllers/employee.controller');

const router = express.Router();
const guard = requireRole('admin');  // للمدير فقط

router.get('/', authenticate, guard, ctrl.list);
router.get('/stats', authenticate, guard, ctrl.stats);
router.get('/:uid', authenticate, guard, ctrl.getOne);

router.post('/', authenticate, guard, [
  body('email').isEmail().withMessage('البريد غير صالح'),
  body('password').isLength({ min: 8 }).withMessage('كلمة المرور 8 أحرف على الأقل'),
  body('fullName').trim().isLength({ min: 3 }).withMessage('الاسم مطلوب'),
], validate, ctrl.create);

router.put('/:uid', authenticate, guard, ctrl.update);
router.post('/:uid/toggle', authenticate, guard, ctrl.toggle);
router.delete('/:uid', authenticate, guard, ctrl.remove);
router.post('/reset-password', authenticate, guard, [
  body('email').isEmail(),
], validate, ctrl.resetPassword);

module.exports = router;
