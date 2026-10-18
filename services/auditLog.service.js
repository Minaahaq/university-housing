'use strict';

const { db } = require('../config/firebase');

const COL = db.collection('auditLogs');

/**
 * قائمة السجلات مع فلاتر.
 */
async function listLogs({
  action,
  userId,
  targetType,
  fromDate,
  toDate,
  search,
  limit = 100,
  offset = 0,
} = {}) {
  let q = COL;

  if (action) q = q.where('action', '==', action);
  if (userId) q = q.where('userId', '==', userId);
  if (targetType) q = q.where('targetType', '==', targetType);

  const snap = await q.get();
  let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // فلترة زمنية
  if (fromDate) {
    const from = new Date(fromDate).getTime();
    docs = docs.filter(d => new Date(d.createdAt).getTime() >= from);
  }
  if (toDate) {
    const to = new Date(toDate).getTime() + 86400000; // نهاية اليوم
    docs = docs.filter(d => new Date(d.createdAt).getTime() <= to);
  }

  // بحث نصي
  if (search) {
    const q2 = search.toLowerCase();
    docs = docs.filter(d =>
      [
        d.action,
        d.targetId,
        d.targetType,
        d.userId,
        JSON.stringify(d.details || {}),
      ].join(' ').toLowerCase().includes(q2)
    );
  }

  // ترتيب تنازلي بالتاريخ
  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const total = docs.length;
  return { data: docs.slice(offset, offset + limit), total };
}

/**
 * إحصائيات سريعة.
 */
async function getStats() {
  const snap = await COL.get();
  const docs = snap.docs.map(d => d.data());

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = docs.filter(d =>
    (d.createdAt || '').slice(0, 10) === today
  ).length;

  const byAction = {};
  const byUser = {};

  docs.forEach(d => {
    byAction[d.action] = (byAction[d.action] || 0) + 1;
    if (d.userId) byUser[d.userId] = (byUser[d.userId] || 0) + 1;
  });

  return {
    total: docs.length,
    today: todayCount,
    byAction,
    byUser,
  };
}

/**
 * جلب قائمة الأسماء (لملء الفلاتر).
 */
async function getDistinct() {
  const snap = await COL.get();
  const actions = new Set();
  const targetTypes = new Set();
  const userIds = new Set();

  snap.forEach(d => {
    const x = d.data();
    if (x.action) actions.add(x.action);
    if (x.targetType) targetTypes.add(x.targetType);
    if (x.userId) userIds.add(x.userId);
  });

  return {
    actions: [...actions].sort(),
    targetTypes: [...targetTypes].sort(),
    userIds: [...userIds],
  };
}

/**
 * جلب سجل واحد.
 */
async function getLog(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

module.exports = { listLogs, getStats, getDistinct, getLog };
