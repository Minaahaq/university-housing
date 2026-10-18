'use strict';

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const env = require('./env');

let serviceAccount;

if (env.firebase.serviceAccountJson) {
  try {
    serviceAccount = JSON.parse(env.firebase.serviceAccountJson);
  } catch (error) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON ليس JSON صالحًا.');
    process.exit(1);
  }
} else {
  const serviceAccountPath = path.resolve(
    process.cwd(),
    env.firebase.serviceAccountPath
  );

  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ ملف Service Account غير موجود: ${serviceAccountPath}`);
    process.exit(1);
  }

  try {
    serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, 'utf8')
    );
  } catch (error) {
    console.error('❌ تعذرت قراءة ملف Service Account.');
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: env.firebase.projectId,
});

const auth = admin.auth();
const db = admin.firestore();

db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, auth, db };
