/* global firebase */
'use strict';

/**
 * ⚠️ استبدل القيم التالية بقيم firebaseConfig من Firebase Console.
 * هذه المفاتيح عامة (خاصة بتطبيق الويب) وليست أسرارًا.
 */
const firebaseConfig = {
  apiKey: "AIzaSyDfZ1OdXc-vc1B0SlG-4MFqK8UQ0KgjzKc",
  authDomain: "ueser-7cba7.firebaseapp.com",
  databaseURL: "https://ueser-7cba7-default-rtdb.firebaseio.com",
  projectId: "ueser-7cba7",
  storageBucket: "ueser-7cba7.firebasestorage.app",
  messagingSenderId: "798059018799",
  appId: "1:798059018799:web:62e19ede1d25ac842424da",
  measurementId: "G-9GZGLPCY3S"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// إبقاء الجلسة محلية
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

window.fbClient = {
  auth,

  async signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  },

  async signOut() {
    return auth.signOut();
  },

  async getIdToken(forceRefresh = false) {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  },

  onAuthStateChanged(cb) {
    return auth.onAuthStateChanged(cb);
  },
};
