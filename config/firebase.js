'use strict';

const admin = require('firebase-admin');

// Only initialise once (guards against hot-reload double-init)
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) {
    console.warn('⚠️  FIREBASE_PRIVATE_KEY not set — Firestore will be unavailable.');
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  privateKey ? privateKey.replace(/\\n/g, '\n') : undefined,
    }),
  });

  console.log(`🔥 Firebase initialised (project: ${process.env.FIREBASE_PROJECT_ID})`);
}

const db = admin.firestore();

module.exports = db;
