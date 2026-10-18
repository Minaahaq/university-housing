'use strict';

const svc = require('../services/employee.service');
const { logAction } = require('../utils/auditLog');
const { parsePagination, buildPageMeta } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { limit, page, offset } = parsePagination(req.query);
    const { data, total } = await svc.listEmployees({
      search: (req.query.search || '').trim(),
      role: req.query.role || undefined,
      status: req.query.status || undefined,
      limit, offset,
    });
    res.json({ success: true, data, meta: buildPageMeta({ page, limit, total }) });
  } catch (e) { next(e); }
}

async function getOne(req, res, next) {
  try { res.json({ success: true, data: await svc.getEmployee(req.params.uid) }); }
  catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const data = await svc.createEmployee(req.body, req.user);
    await logAction({
      userId: req.user.uid, action: 'employee.create',
      targetType: 'employee', targetId: data.uid,
      details: { email: data.email, fullName: data.fullName }, req,
    });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const data = await svc.updateEmployee(req.params.uid, req.body, req.user);
    await logAction({
      userId: req.user.uid, action: 'employee.update',
      targetType: 'employee', targetId: req.params.uid, req,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function toggle(req, res, next) {
  try {
    const data = await svc.toggleEmployee(req.params.uid, req.user);
    await logAction({
      userId: req.user.uid, action: 'employee.toggle',
      targetType: 'employee', targetId: req.params.uid,
      details: { status: data.status }, req,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await svc.deleteEmployee(req.params.uid, req.user);
    await logAction({
      userId: req.user.uid, action: 'employee.delete',
      targetType: 'employee', targetId: req.params.uid, req,
    });
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function resetPassword(req, res, next) {
  try {
    const data = await svc.resetPassword(req.body.email);
    await logAction({
      userId: req.user.uid, action: 'employee.reset_password',
      targetType: 'employee', targetId: req.body.email, req,
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function stats(req, res, next) {
  try { res.json({ success: true, data: await svc.getStats() }); }
  catch (e) { next(e); }
}

module.exports = { list, getOne, create, update, toggle, remove, resetPassword, stats };
