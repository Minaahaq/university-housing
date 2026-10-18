'use strict';

const svc = require('../services/auditLog.service');
const { parsePagination, buildPageMeta } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { limit, page, offset } = parsePagination(req.query);
    const { data, total } = await svc.listLogs({
      action: req.query.action || undefined,
      userId: req.query.userId || undefined,
      targetType: req.query.targetType || undefined,
      fromDate: req.query.fromDate || undefined,
      toDate: req.query.toDate || undefined,
      search: (req.query.search || '').trim() || undefined,
      limit,
      offset,
    });
    res.json({ success: true, data, meta: buildPageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

async function stats(req, res, next) {
  try { res.json({ success: true, data: await svc.getStats() }); }
  catch (err) { next(err); }
}

async function distinct(req, res, next) {
  try { res.json({ success: true, data: await svc.getDistinct() }); }
  catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const log = await svc.getLog(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'السجل غير موجود' });
    res.json({ success: true, data: log });
  } catch (err) { next(err); }
}

module.exports = { list, stats, distinct, getOne };
