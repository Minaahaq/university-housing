'use strict';

const { db, admin } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const COL = db.collection('payments');

async function list({ q, limit, offset }) {
  const snapshot = await COL.get();
  let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  if (q) {
    const needle = q.toLowerCase();
    docs = docs.filter(p =>
      [p.month, p.notes].join(' ').toLowerCase().includes(needle));
  }
  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = docs.length;
  return { data: docs.slice(offset, offset + limit), total };
}

async function get(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الدفعة غير موجودة');
  return { id: doc.id, ...doc.data() };
}

async function create(input, actor) {
  if (!input.studentId) throw ApiError.badRequest('الطالب مطلوب');
  if (!input.month) throw ApiError.badRequest('الشهر مطلوب');

  const now = new Date().toISOString();
  const result = await db.runTransaction(async (tx) => {
    // منع تكرار نفس الدفعة (نفس الطالب + نفس الشهر + نفس المبلغ + نفس اليوم)
    const dupQuery = COL.where('studentId', '==', input.studentId)
      .where('month', '==', input.month)
      .limit(20);
    const dupSnap = await tx.get(dupQuery);
    const sameDay = now.slice(0, 10);
    const dup = dupSnap.docs.find(d => {
      const x = d.data();
      return x.createdAt?.slice(0, 10) === sameDay
        && Number(x.due) === Number(input.due)
        && Number(x.paid) === Number(input.paid);
    });
    if (dup) throw ApiError.conflict('دفعة مشابهة مسجلة اليوم لهذا الطالب');

    const ref = COL.doc();
    tx.set(ref, {
      studentId: input.studentId,
      month: input.month,
      due: Number(input.due) || 0,
      paid: Number(input.paid) || 0,
      date: input.date || now.slice(0, 10),
      notes: input.notes || null,
      receiptNumber: 'RCP-' + Date.now().toString(36).toUpperCase(),
      createdBy: actor?.uid || null,
      createdAt: now, updatedAt: now,
    });
    return ref.id;
  });

  return get(result);
}

async function remove(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الدفعة غير موجودة');
  await COL.doc(id).delete();
}

module.exports = { list, get, create, remove };
