'use strict';

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/student.controller');
const v = require('../validators/student.validator');

const router = express.Router();

router.get('/',
  authenticate,
  requirePermission('students.view'),
  ctrl.list);

router.get('/:id',
  authenticate,
  requirePermission('students.view'),
  ctrl.getOne);

router.post('/',
  authenticate,
  requirePermission('students.create'),
  v.createRules(),
  validate,
  ctrl.create);

router.put('/:id',
  authenticate,
  requirePermission('students.update'),
  v.updateRules(),
  validate,
  ctrl.update);

router.delete('/:id',
  authenticate,
  requirePermission('students.delete'),
  ctrl.remove);

module.exports = router;
