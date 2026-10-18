'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/auditLog.controller');

const router = express.Router();

// سجل النشاط للمدير فقط
const guard = requireRole('admin');

router.get('/', authenticate, guard, ctrl.list);
router.get('/stats', authenticate, guard, ctrl.stats);
router.get('/distinct', authenticate, guard, ctrl.distinct);
router.get('/:id', authenticate, guard, ctrl.getOne);

module.exports = router;
