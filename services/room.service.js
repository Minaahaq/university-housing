'use strict';

const { db } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const BUILDINGS = db.collection('buildings');
const ROOMS = db.collection('rooms');
const STUDENTS = db.collection('students');

/* ==========================================
   Buildings
   ========================================== */
async function listBuildings() {
  const snap = await BUILDINGS.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createBuilding(input, actor) {
  const now = new Date().toISOString();
  const ref = await BUILDINGS.add({
    name: input.name,
    floors: Number(input.floors) || 1,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.uid || null,
  });
  return { id: ref.id, ...input, createdAt: now };
}

async function updateBuilding(id, input, actor) {
  const doc = await BUILDINGS.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('المبنى غير موجود');
  await BUILDINGS.doc(id).update({
    name: input.name ?? doc.data().name,
    floors: input.floors !== undefined ? Number(input.floors) : doc.data().floors,
    notes: input.notes !== undefined ? input.notes : doc.data().notes,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  });
  return { id, ...doc.data(), ...input };
}

async function deleteBuilding(id) {
  // امنع الحذف لو فيه غرف
  const rooms = await ROOMS.where('buildingId', '==', id).limit(1).get();
  if (!rooms.empty) throw ApiError.conflict('لا يمكن حذف مبنى يحتوي على غرف');
  await BUILDINGS.doc(id).delete();
}

/* ==========================================
   Rooms
   ========================================== */
async function listRooms(filters = {}) {
  let q = ROOMS;
  if (filters.buildingId) q = q.where('buildingId', '==', filters.buildingId);
  if (filters.status) q = q.where('status', '==', filters.status);

  const snap = await q.get();
  let rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // جلب أسماء المباني
  const buildingsSnap = await BUILDINGS.get();
  const buildingMap = {};
  buildingsSnap.forEach(d => { buildingMap[d.id] = d.data().name; });

  rooms = rooms.map(r => ({ ...r, buildingName: buildingMap[r.buildingId] || '—' }));
  return rooms;
}

async function getRoom(id) {
  const doc = await ROOMS.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الغرفة غير موجودة');
  const room = { id: doc.id, ...doc.data() };

  // جلب بيانات الطلاب
  if (room.occupants && room.occupants.length > 0) {
    const studentsSnap = await STUDENTS.where('__name__', 'in',
      room.occupants.slice(0, 10)).get();
    room.occupantsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    room.occupantsData = [];
  }
  return room;
}

async function createRoom(input, actor) {
  const capacity = Number(input.capacity) || 1;
  const roomType = input.roomType || capacityToString(capacity);

  // تحقق من عدم التكرار (نفس المبنى + نفس الجناح + نفس الدور + نفس الرقم)
  const existing = await ROOMS
    .where('buildingId', '==', input.buildingId)
    .where('wing', '==', input.wing)
    .where('floor', '==', input.floor)
    .where('roomNumber', '==', input.roomNumber)
    .limit(1)
    .get();
  if (!existing.empty) throw ApiError.conflict('غرفة بنفس الرقم موجودة في هذا الجناح');

  const now = new Date().toISOString();
  const ref = await ROOMS.add({
    buildingId: input.buildingId,
    wing: input.wing,
    floor: input.floor,
    roomNumber: input.roomNumber,
    capacity,
    roomType,
    status: input.status || 'متاحة',
    occupants: [],
    occupantCount: 0,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.uid || null,
  });

  return getRoom(ref.id);
}

async function updateRoom(id, input, actor) {
  const doc = await ROOMS.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الغرفة غير موجودة');
  const data = doc.data();

  const capacity = input.capacity !== undefined
    ? Number(input.capacity)
    : data.capacity;

  // منع تقليل السعة تحت عدد المقيمين
  if (capacity < data.occupantCount) {
    throw ApiError.conflict(
      `لا يمكن تقليل السعة إلى ${capacity}. يوجد ${data.occupantCount} طالب مقيم.`
    );
  }

  const patch = {
    ...(input.buildingId !== undefined && { buildingId: input.buildingId }),
    ...(input.wing !== undefined && { wing: input.wing }),
    ...(input.floor !== undefined && { floor: input.floor }),
    ...(input.roomNumber !== undefined && { roomNumber: input.roomNumber }),
    ...(input.capacity !== undefined && { capacity }),
    ...(input.roomType !== undefined && { roomType: input.roomType }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  };

  await ROOMS.doc(id).update(patch);
  return getRoom(id);
}

async function deleteRoom(id) {
  const doc = await ROOMS.doc(id).get();
  if (!doc.exists) throw ApiError.notFound('الغرفة غير موجودة');
  if (doc.data().occupantCount > 0) {
    throw ApiError.conflict('لا يمكن حذف غرفة تحتوي على طلاب. أخلِ الطلاب أولًا.');
  }
  await ROOMS.doc(id).delete();
}

/* ==========================================
   Assign / Unassign Student
   ========================================== */
async function assignStudent({ roomId, studentId, actor }) {
  return db.runTransaction(async (tx) => {
    const roomRef = ROOMS.doc(roomId);
    const studentRef = STUDENTS.doc(studentId);

    const roomSnap = await tx.get(roomRef);
    const studentSnap = await tx.get(studentRef);

    if (!roomSnap.exists) throw ApiError.notFound('الغرفة غير موجودة');
    if (!studentSnap.exists) throw ApiError.notFound('الطالب غير موجود');

    const room = roomSnap.data();
    const student = studentSnap.data();

    // إذا كان الطالب في غرفة أخرى → أزله منها أولًا
    if (student.roomId && student.roomId !== roomId) {
      const oldRoomRef = ROOMS.doc(student.roomId);
      const oldRoomSnap = await tx.get(oldRoomRef);
      if (oldRoomSnap.exists) {
        const oldData = oldRoomSnap.data();
        const newOccupants = (oldData.occupants || []).filter(x => x !== studentId);
        tx.update(oldRoomRef, {
          occupants: newOccupants,
          occupantCount: newOccupants.length,
          status: newOccupants.length < oldData.capacity ? 'متاحة' : oldData.status,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // تحقق من السعة
    if (room.occupantCount >= room.capacity) {
      throw ApiError.conflict(`الغرفة ممتلئة (${room.capacity}/${room.capacity})`);
    }

    // تحقق من عدم وجود الطالب بالفعل
    if (room.occupants && room.occupants.includes(studentId)) {
      throw ApiError.conflict('الطالب مسكن بالفعل في هذه الغرفة');
    }

    // أضف الطالب للغرفة
    const newOccupants = [...(room.occupants || []), studentId];
    const newCount = newOccupants.length;

    tx.update(roomRef, {
      occupants: newOccupants,
      occupantCount: newCount,
      status: newCount >= room.capacity ? 'مشغولة' : 'متاحة',
      updatedAt: new Date().toISOString(),
    });

    // حدّث الطالب
    tx.update(studentRef, {
      roomId,
      room: room.roomNumber,
      wing: room.wing,
      floor: room.floor,
      roomType: room.roomType,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.uid || null,
    });

    return { success: true };
  });
}

async function unassignStudent({ studentId, actor }) {
  return db.runTransaction(async (tx) => {
    const studentRef = STUDENTS.doc(studentId);
    const studentSnap = await tx.get(studentRef);

    if (!studentSnap.exists) throw ApiError.notFound('الطالب غير موجود');
    const student = studentSnap.data();

    if (!student.roomId) throw ApiError.badRequest('الطالب غير مسكن في أي غرفة');

    const roomRef = ROOMS.doc(student.roomId);
    const roomSnap = await tx.get(roomRef);

    if (roomSnap.exists) {
      const room = roomSnap.data();
      const newOccupants = (room.occupants || []).filter(x => x !== studentId);
      tx.update(roomRef, {
        occupants: newOccupants,
        occupantCount: newOccupants.length,
        status: 'متاحة',
        updatedAt: new Date().toISOString(),
      });
    }

    tx.update(studentRef, {
      roomId: null,
      room: null,
      wing: null,
      floor: null,
      roomType: null,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.uid || null,
    });

    return { success: true };
  });
}

/* ==========================================
   Helpers
   ========================================== */
function capacityToString(cap) {
  const map = { 1: 'فردية', 2: 'ثنائية', 3: 'ثلاثية', 4: 'رباعية' };
  return map[cap] || 'أخرى';
}

async function getStats() {
  const buildingsSnap = await BUILDINGS.get();
  const roomsSnap = await ROOMS.get();

  let totalCapacity = 0;
  let totalOccupied = 0;
  let available = 0;
  let maintenance = 0;

  roomsSnap.forEach(d => {
    const r = d.data();
    totalCapacity += Number(r.capacity || 0);
    totalOccupied += Number(r.occupantCount || 0);
    if (r.status === 'صيانة') maintenance++;
    else if (r.occupantCount < r.capacity) available++;
  });

  return {
    buildings: buildingsSnap.size,
    rooms: roomsSnap.size,
    totalCapacity,
    totalOccupied,
    availableBeds: totalCapacity - totalOccupied,
    available,
    maintenance,
    occupancyRate: totalCapacity > 0
      ? Math.round((totalOccupied / totalCapacity) * 100)
      : 0,
  };
}

module.exports = {
  listBuildings, createBuilding, updateBuilding, deleteBuilding,
  listRooms, getRoom, createRoom, updateRoom, deleteRoom,
  assignStudent, unassignStudent,
  getStats,
};
