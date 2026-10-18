'use strict';

const { db, auth } = require('../config/firebase');
const ApiError = require('../utils/ApiError');

const USERS = db.collection('users');

/**
 * قائمة الموظفين (كل المستخدمين ما عدا المدير نفسه إن أردت).
 */
async function listEmployees({ search, role, status, limit = 100, offset = 0 } = {}) {
  const snap = await USERS.get();
  let docs = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  if (role) docs = docs.filter(u => u.role === role);
  if (status) docs = docs.filter(u => (u.status || 'active') === status);

  if (search) {
    const q = search.toLowerCase();
    docs = docs.filter(u =>
      [u.fullName, u.email, u.phone].join(' ').toLowerCase().includes(q)
    );
  }

  docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const total = docs.length;
  return { data: docs.slice(offset, offset + limit), total };
}

/**
 * جلب موظف واحد.
 */
async function getEmployee(uid) {
  const doc = await USERS.doc(uid).get();
  if (!doc.exists) throw ApiError.notFound('الموظف غير موجود');
  return { uid: doc.id, ...doc.data() };
}

/**
 * إنشاء موظف جديد (Auth + Firestore).
 */
async function createEmployee(input, actor) {
  const { email, password, fullName, phone, permissions } = input;

  if (!email || !password) {
    throw ApiError.badRequest('البريد وكلمة المرور مطلوبان');
  }
  if (password.length < 8) {
    throw ApiError.badRequest('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }

  // تحقق من عدم تكرار البريد
  try {
    await auth.getUserByEmail(email);
    throw ApiError.conflict('البريد الإلكتروني مستخدم بالفعل');
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  // 1) إنشاء حساب Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: fullName });
  } catch (err) {
    throw ApiError.badRequest('فشل إنشاء الحساب: ' + err.message);
  }

  // 2) إنشاء مستند المستخدم في Firestore
  const now = new Date().toISOString();
  try {
    await USERS.doc(userRecord.uid).set({
      fullName: fullName || 'موظف',
      email,
      phone: phone || null,
      role: 'employee',
      permissions: Array.isArray(permissions) ? permissions : [],
      status: 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: actor?.uid || null,
    });
  } catch (err) {
    // rollback: احذف حساب Auth
    await auth.deleteUser(userRecord.uid).catch(() => {});
    throw ApiError.internal('فشل حفظ بيانات الموظف');
  }

  return getEmployee(userRecord.uid);
}

/**
 * تحديث بيانات الموظف.
 */
async function updateEmployee(uid, input, actor) {
  const doc = await USERS.doc(uid).get();
  if (!doc.exists) throw ApiError.notFound('الموظف غير موجود');

  const data = doc.data();
  if (data.role === 'admin' && actor?.uid !== uid) {
    throw ApiError.forbidden('لا يمكن تعديل حساب مدير آخر');
  }

  const patch = {
    ...(input.fullName !== undefined && { fullName: input.fullName }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.permissions !== undefined && {
      permissions: Array.isArray(input.permissions) ? input.permissions : [],
    }),
    ...(input.status !== undefined && { status: input.status }),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  };

  await USERS.doc(uid).update(patch);

  // حدّث displayName في Auth
  if (input.fullName) {
    await auth.updateUser(uid, { displayName: input.fullName }).catch(() => {});
  }

  return getEmployee(uid);
}

/**
 * تعطيل/تفعيل الحساب.
 */
async function toggleEmployee(uid, actor) {
  const doc = await USERS.doc(uid).get();
  if (!doc.exists) throw ApiError.notFound('الموظف غير موجود');
  const data = doc.data();

  if (data.role === 'admin') throw ApiError.forbidden('لا يمكن تعطيل حساب مدير');
  if (uid === actor?.uid) throw ApiError.forbidden('لا يمكنك تعطيل حسابك');

  const newStatus = data.status === 'disabled' ? 'active' : 'disabled';

  await USERS.doc(uid).update({
    status: newStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.uid || null,
  });

  await auth.updateUser(uid, { disabled: newStatus === 'disabled' }).catch(() => {});

  return { uid, status: newStatus };
}

/**
 * حذف الموظف.
 */
async function deleteEmployee(uid, actor) {
  const doc = await USERS.doc(uid).get();
  if (!doc.exists) throw ApiError.notFound('الموظف غير موجود');
  const data = doc.data();

  if (data.role === 'admin') throw ApiError.forbidden('لا يمكن حذف حساب مدير');
  if (uid === actor?.uid) throw ApiError.forbidden('لا يمكنك حذف حسابك');

  // حذف من Auth أولًا
  await auth.deleteUser(uid).catch(err => {
    if (err.code !== 'auth/user-not-found') throw err;
  });

  // حذف من Firestore
  await USERS.doc(uid).delete();
}

/**
 * إرسال بريد إعادة تعيين كلمة المرور.
 */
async function resetPassword(email) {
  // Firebase Admin لا يرسل بريد إعادة تعيين مباشرة.
  // نستخدم generatePasswordResetLink ثم نرسله يدويًا (يتطلب SMTP).
  // كبديل: نستخدم sendPasswordResetEmail من client SDK.
  // هنا سنستخدم generatePasswordResetLink ونعيده للـ frontend.
  try {
    const link = await auth.generatePasswordResetLink(email);
    return { link };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw ApiError.notFound('لا يوجد حساب بهذا البريد');
    }
    throw err;
  }
}

/**
 * إحصائيات.
 */
async function getStats() {
  const snap = await USERS.get();
  const docs = snap.docs.map(d => d.data());

  return {
    total: docs.length,
    admins: docs.filter(d => d.role === 'admin').length,
    employees: docs.filter(d => d.role === 'employee').length,
    active: docs.filter(d => (d.status || 'active') === 'active').length,
    disabled: docs.filter(d => d.status === 'disabled').length,
  };
}

module.exports = {
  listEmployees, getEmployee, createEmployee,
  updateEmployee, toggleEmployee, deleteEmployee,
  resetPassword, getStats,
};
