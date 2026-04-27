const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const config = require('./index');
const logger = require('../utils/logger');

let db;

const initFirebase = () => {
  const serviceAccountPath = path.resolve(config.firebaseServiceAccountPath);

  if (!fs.existsSync(serviceAccountPath)) {
    logger.warn('Firebase service account key not found at:', serviceAccountPath);
    logger.warn('Firebase RTDB features will be disabled. Place serviceAccountKey.json in backend-otp/');
    return null;
  }

  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: config.firebaseDatabaseUrl,
  });

  db = admin.database();
  logger.info('Firebase Admin initialized');
  return db;
};

const getFirebaseDB = () => db;
const getFirebaseAdmin = () => admin;

module.exports = { initFirebase, getFirebaseDB, getFirebaseAdmin };
