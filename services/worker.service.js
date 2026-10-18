'use strict';

const { db } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const COL = db.collection('workers');

async function list({ q, limit, offset }) {
  const snapshot = await COL.get();
  let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (q) {
    const needle = q.toLowerCase();
    docs = docs.filter(w => [w.name, w.job, w.phone].join(' ').toLowerCase().includes(needle));
  }
  const total = docs.length;
  return { data: docs.slice(offset, offset + limit), total };
}

async function get(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('العامل غير موجود');
  return { id: doc.id, ...doc.data() };
}

async function create(input, actor) {
  const now = new Date().toISOString();
  const ref = await COL.add({
    name: input.name, job: input.job || null, phone: input.phone || null,
    from: input.from || null, to: input.to || null,
    due: Number(input.due) || 0, paid: Number(input.paid) || 0,
    notes: input.notes || null,
    createdAt: now, updatedAt: now, createdBy: actor?.uid || null,
  });
  return get(ref.id);
}

async function update(id, input, actor) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('العامل غير موجود');
  const patch = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.job !== undefined && { job: input.job || null }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.from !== undefined && { from: input.from || null }),
    ...(input.to !== undefined && { to: input.to || null }),
    ...(input.due !== undefined && { due: Number(input.due) || 0 }),
    ...(input.paid !== undefined && { paid: Number(input.paid) || 0 }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    updatedAt: new Date().toISOString(), updatedBy: actor?.uid || null,
  };
  await COL.doc(id).update(patch);
  return get(id);
}

async function remove(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('العامل غير موجود');
  await COL.doc(id).delete();
}

module.exports = { list, get, create, update, remove };
