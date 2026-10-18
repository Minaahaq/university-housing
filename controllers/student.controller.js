'use strict';

const studentService = require('../services/student.service');
const { logAction } = require('../utils/auditLog');
const { parsePagination, buildPageMeta } = require('../utils/pagination');

async function list(req, res, next) {
  try {
    const { limit, page, offset } = parsePagination(req.query);
    const { data, total } = await studentService.listStudents({
      q: (req.query.q || '').trim(),
      college: req.query.college,
      status: req.query.status,
      limit,
      offset,
    });
    res.json({ success: true, data, meta: buildPageMeta({ page, limit, total }) });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const data = await studentService.getStudent(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = await studentService.createStudent(req.body, req.user);
    await logAction({
      userId: req.user.uid, action: 'student.create',
      targetType: 'student', targetId: data.id,
      details: { name: data.name }, req,
    });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = await studentService.updateStudent(req.params.id, req.body, req.user);
    await logAction({
      userId: req.user.uid, action: 'student.update',
      targetType: 'student', targetId: data.id,
      details: { name: data.name }, req,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const data = await studentService.archiveStudent(req.params.id, req.user);
    await logAction({
      userId: req.user.uid, action: 'student.archive',
      targetType: 'student', targetId: data.id,
      details: { name: data.name }, req,
    });
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove };
