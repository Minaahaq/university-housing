'use strict';

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const env = require('./env');

const serviceAccountPath = path.resolve(env.firebase.serviceAccountPath);

if (!fs.existsSync(serviceAccountPath)) {
  // eslint-disable-next-line no-console
  console.error(`❌ ملف Service Account غير موجود في: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: env.firebase.projectId,
});

const auth = admin.auth();
const db = admin.firestore();

// إعدادات Firestore
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, auth, db };
