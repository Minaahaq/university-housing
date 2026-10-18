'use strict';

const svc = require('../services/payment.service');
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
    await logAction({ userId: req.user.uid, action: 'payment.create',
      targetType: 'payment', targetId: data.id, req });
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}
async function remove(req, res, next) {
  try {
    await svc.remove(req.params.id);
    await logAction({ userId: req.user.uid, action: 'payment.delete',
      targetType: 'payment', targetId: req.params.id, req });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { list, getOne, create, remove };
