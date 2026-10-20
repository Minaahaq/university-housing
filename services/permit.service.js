'use strict';

const { db } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const COL = db.collection('permits');

async function list({ q, limit, offset }) {
  const snapshot = await COL.get();
  let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (q) {
    const needle = q.toLowerCase();
    docs = docs.filter(p =>
      [
        p.type, p.date, p.details, p.clinic,
        p.companion, p.supervisor, p.exitTime, p.returnTime,
      ].join(' ').toLowerCase().includes(needle));
  }
  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = docs.length;
  return { data: docs.slice(offset, offset + limit), total };
}

async function get(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('التصريح غير موجود');
  return { id: doc.id, ...doc.data() };
}

async function create(input, actor) {
  const studentDoc = await db.collection('students').doc(input.studentId).get();
  if (!studentDoc.exists) throw ApiError.badRequest('الطالب غير موجود');

  const now = new Date().toISOString();
  const ref = await COL.add({
    studentId: input.studentId,
    type: input.type,
    date: input.date,
    time: input.time || null,
    clinic: input.clinic || null,
    companion: input.companion || null,
    supervisor: input.supervisor || null,
    returnAt: input.returnAt || null,
    exitTime: input.exitTime || null,
    returnTime: input.returnTime || null,
    details: input.details || null,
    status: 'قيد المراجعة',
    createdBy: actor?.uid || null,
    createdAt: now, updatedAt: now,
  });
  return get(ref.id);
}

async function approve(id, actor) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('التصريح غير موجود');
  await COL.doc(id).update({
    status: 'معتمد', approvedBy: actor?.uid || null,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return get(id);
}

async function reject(id, actor) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('التصريح غير موجود');
  await COL.doc(id).update({
    status: 'مرفوض', rejectedBy: actor?.uid || null,
    rejectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return get(id);
}

async function remove(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('التصريح غير موجود');
  await COL.doc(id).delete();
}

module.exports = { list, get, create, approve, reject, remove };
