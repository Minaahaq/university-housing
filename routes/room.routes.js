'use strict';

const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');
const ctrl = require('../controllers/room.controller');

const router = express.Router();
const guard = requirePermission('rooms.manage');

/* Buildings */
router.get('/buildings', authenticate, guard, ctrl.listBuildings);
router.post('/buildings', authenticate, guard,
  [body('name').trim().isLength({ min: 2 })],
  validate, ctrl.createBuilding);
router.put('/buildings/:id', authenticate, guard, ctrl.updateBuilding);
router.delete('/buildings/:id', authenticate, guard, ctrl.deleteBuilding);

/* Rooms */
router.get('/rooms', authenticate, guard, ctrl.listRooms);
router.get('/rooms/:id', authenticate, guard, ctrl.getRoom);
router.post('/rooms', authenticate, guard,
  [body('buildingId').notEmpty(), body('wing').notEmpty(),
   body('floor').notEmpty(), body('roomNumber').notEmpty(),
   body('capacity').isInt({ min: 1, max: 20 })],
  validate, ctrl.createRoom);
router.put('/rooms/:id', authenticate, guard, ctrl.updateRoom);
router.delete('/rooms/:id', authenticate, guard, ctrl.deleteRoom);

/* Assignment */
router.post('/rooms/:id/assign', authenticate, guard,
  [body('studentId').notEmpty()], validate, ctrl.assign);
router.post('/rooms/:id/unassign', authenticate, guard,
  [body('studentId').notEmpty()], validate, ctrl.unassign);

/* Stats */
router.get('/stats', authenticate, guard, ctrl.stats);

module.exports = router;
