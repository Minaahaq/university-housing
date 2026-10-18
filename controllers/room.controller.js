'use strict';

const svc = require('../services/room.service');
const { logAction } = require('../utils/auditLog');

/* Buildings */
async function listBuildings(req, res, next) {
  try { res.json({ success: true, data: await svc.listBuildings() }); }
  catch (e) { next(e); }
}
async function createBuilding(req, res, next) {
  try {
    const data = await svc.createBuilding(req.body, req.user);
    await logAction({ userId: req.user.uid, action: 'building.create',
      targetType: 'building', targetId: data.id, req });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}
async function updateBuilding(req, res, next) {
  try {
    const data = await svc.updateBuilding(req.params.id, req.body, req.user);
    await logAction({ userId: req.user.uid, action: 'building.update',
      targetType: 'building', targetId: req.params.id, req });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
async function deleteBuilding(req, res, next) {
  try {
    await svc.deleteBuilding(req.params.id);
    await logAction({ userId: req.user.uid, action: 'building.delete',
      targetType: 'building', targetId: req.params.id, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* Rooms */
async function listRooms(req, res, next) {
  try {
    const data = await svc.listRooms({
      buildingId: req.query.buildingId,
      status: req.query.status,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
async function getRoom(req, res, next) {
  try { res.json({ success: true, data: await svc.getRoom(req.params.id) }); }
  catch (e) { next(e); }
}
async function createRoom(req, res, next) {
  try {
    const data = await svc.createRoom(req.body, req.user);
    await logAction({ userId: req.user.uid, action: 'room.create',
      targetType: 'room', targetId: data.id, req });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}
async function updateRoom(req, res, next) {
  try {
    const data = await svc.updateRoom(req.params.id, req.body, req.user);
    await logAction({ userId: req.user.uid, action: 'room.update',
      targetType: 'room', targetId: req.params.id, req });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
async function deleteRoom(req, res, next) {
  try {
    await svc.deleteRoom(req.params.id);
    await logAction({ userId: req.user.uid, action: 'room.delete',
      targetType: 'room', targetId: req.params.id, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* Assignment */
async function assign(req, res, next) {
  try {
    await svc.assignStudent({
      roomId: req.params.id,
      studentId: req.body.studentId,
      actor: req.user,
    });
    await logAction({ userId: req.user.uid, action: 'room.assign',
      targetType: 'room', targetId: req.params.id,
      details: { studentId: req.body.studentId }, req });
    res.json({ success: true, message: 'تم تسكين الطالب' });
  } catch (e) { next(e); }
}
async function unassign(req, res, next) {
  try {
    await svc.unassignStudent({
      studentId: req.body.studentId,
      actor: req.user,
    });
    await logAction({ userId: req.user.uid, action: 'room.unassign',
      targetType: 'room', targetId: req.params.id,
      details: { studentId: req.body.studentId }, req });
    res.json({ success: true, message: 'تم إخلاء الطالب' });
  } catch (e) { next(e); }
}

/* Stats */
async function stats(req, res, next) {
  try { res.json({ success: true, data: await svc.getStats() }); }
  catch (e) { next(e); }
}

module.exports = {
  listBuildings, createBuilding, updateBuilding, deleteBuilding,
  listRooms, getRoom, createRoom, updateRoom, deleteRoom,
  assign, unassign,
  stats,
};
