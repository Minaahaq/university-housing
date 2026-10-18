'use strict';

const { db } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const COL = db.collection('students');

async function listStudents({ q, college, status, limit, offset }) {
  let query = COL;

  if (college) query = query.where('college', '==', college);
  if (status)  query = query.where('status', '==', status);

  const snapshot = await query.get();
  let docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (q) {
    const needle = q.toLowerCase();
    docs = docs.filter((s) =>
      [s.name, s.phone, s.room, s.college, s.national]
        .join(' ').toLowerCase().includes(needle)
    );
  }

  const total = docs.length;
  const paged = docs.slice(offset, offset + limit);
  return { data: paged, total };
}

async function getStudent(id) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الطالب غير موجود');
  return { id: doc.id, ...doc.data() };
}

async function createStudent(input, actor) {
  const now = new Date().toISOString();

  if (input.national) {
    const dup = await COL.where('national', '==', input.national).limit(1).get();
    if (!dup.empty) throw ApiError.conflict('الرقم القومي مسجل مسبقًا');
  }

  const docRef = await COL.add({
    name: input.name,
    national: input.national || null,
    phone: input.phone || null,
    email: input.email || null,
    college: input.college || null,
    year: input.year || null,
    wing: input.wing || null,
    floor: input.floor || null,
    room: input.room || null,
    roomType: input.roomType || null,
    status: input.status || 'مقيم',
    monthly: Number(input.monthly) || 0,
    notes: input.notes || null,
    archived: false,
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.uid || null,
  });

  return getStudent(docRef.id);
}

async function updateStudent(id, input, actor) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الطالب غير موجود');

  if (input.national && input.national !== doc.data().national) {
    const dup = await COL.where('national', '==', input.national).limit(1).get();
    if (!dup.empty) throw ApiError.conflict('الرقم القومي مسجل مسبقًا');
  }

  const patch = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.national !== undefined && { national: input.national || null }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...(input.college !== undefined && { college: input.college || null }),
    ...(input.year !== undefined && { year: input.year || null }),
    ...(input.wing !== undefined && { wing: input.wing || null }),
    ...(input.floor !== undefined && { floor: input.floor || null }),
    ...(input.room !== undefined && { room: input.room || null }),
    ...(input.roomType !== undefined && { roomType: input.roomType || null }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.monthly !== undefined && { monthly: Number(input.monthly) || 0 }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  };

  await COL.doc(id).update(patch);
  return getStudent(id);
}

async function archiveStudent(id, actor) {
  const doc = await COL.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الطالب غير موجود');
  await COL.doc(id).update({
    archived: true,
    status: 'منسحب',
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  });
  return getStudent(id);
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  archiveStudent,
};
