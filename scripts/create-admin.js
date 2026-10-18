'use strict';

/**
 * إنشاء حساب مدير آمن.
 * الاستخدام:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_FULLNAME="..." node scripts/create-admin.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const saPath = path.resolve(
  process.cwd(),
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/serviceAccountKey.json'
);
if (!fs.existsSync(saPath)) {
  console.error(`❌ ملف Service Account غير موجود: ${saPath}`);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(saPath)),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULLNAME || 'مدير النظام';

  if (!email || !password) {
    console.error('❌ يجب تعيين ADMIN_EMAIL و ADMIN_PASSWORD في البيئة.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
    process.exit(1);
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`ℹ️  المستخدم موجود مسبقًا: ${userRecord.uid}`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({ email, password, displayName: fullName });
      console.log(`✅ تم إنشاء مستخدم Firebase Auth: ${userRecord.uid}`);
    } else {
      throw e;
    }
  }

  const ref = db.collection('users').doc(userRecord.uid);
  const now = new Date().toISOString();
  await ref.set({
    fullName,
    email,
    role: 'admin',
    status: 'active',
    permissions: [],
    createdAt: now,
    updatedAt: now,
  }, { merge: true });

  console.log('✅ تم إنشاء/تحديث مستند المستخدم في Firestore.');
  console.log(`   UID: ${userRecord.uid}`);
  console.log(`   Email: ${email}`);
  console.log('');
  console.log('⚠️  احذف ADMIN_PASSWORD من .env الآن.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
