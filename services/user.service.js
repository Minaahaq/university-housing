'use strict';

const { db } = require('../config/firebase');

const USERS = db.collection('users');

async function getUserById(uid) {
  const doc = await USERS.doc(uid).get();
  if (!doc.exists) return null;
  return { uid: doc.id, ...doc.data() };
}

async function createUserProfile(data) {
  const now = new Date().toISOString();
  const payload = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await USERS.doc(data.uid).set(payload);
  return payload;
}

module.exports = { getUserById, createUserProfile };
