'use strict';

const svc = require('../services/permit.service');
const { logAction } = require('../utils/auditLog');
const { parsePagination, buildPageMeta } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { limit, page, offset } = parsePagination(req.query);
    const { data, total } = await svc.list({ q: (req.query.q || '').trim(), limit, offset });
    res.json({ success: true, data, meta: buildPageMeta({ page, limit, total }) });
  } catch (e) { next(e); }
}
async function getOne(req, res, next) {
  try { res.json({ success: true, data: await svc.get(req.params.id) }); }
  catch (e) { next(e); }
}
async function create(req, res, next) {
  try {
    const data = await svc.create(req.body, req.user);
    await logAction({ userId: req.user.uid, action: 'permit.create',
      targetType: 'permit', targetId: data.id, req });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}
async function approve(req, res, next) {
  try {
    const data = await svc.approve(req.params.id, req.user);
    await logAction({ userId: req.user.uid, action: 'permit.approve',
      targetType: 'permit', targetId: data.id, req });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
async function reject(req, res, next) {
  try {
    const data = await svc.reject(req.params.id, req.user);
    await logAction({ userId: req.user.uid, action: 'permit.reject',
      targetType: 'permit', targetId: data.id, req });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}
async function remove(req, res, next) {
  try {
    await svc.remove(req.params.id);
    await logAction({ userId: req.user.uid, action: 'permit.delete',
      targetType: 'permit', targetId: req.params.id, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { list, getOne, create, approve, reject, remove };
