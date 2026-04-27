const { getFirebaseDB } = require('../config/firebase');
const logger = require('../utils/logger');

// Write OTP request to RTDB for the APK to pick up
const writeOtpRequest = async (businessId, requestId, data) => {
  const db = getFirebaseDB();
  if (!db) {
    logger.warn('Firebase not initialized — simulating SMS send (dev mode)');
    return { simulated: true };
  }

  const ref = db.ref(`otp_requests/${businessId}/${requestId}`);
  await ref.set({
    recipient: data.recipient,
    message: data.message,
    status: 'pending',
    target_sim_id: data.targetSimId,
    created_at: Date.now(),
    picked_by: null,
    picked_at: null,
    sent_at: null,
    failure_reason: null,
    attempt: data.attempt || 1,
  });

  return { simulated: false, ref };
};

// Update target SIM for failover (retry with next SIM)
const retryWithNextSim = async (businessId, requestId, nextSimId, attempt) => {
  const db = getFirebaseDB();
  if (!db) return;

  const ref = db.ref(`otp_requests/${businessId}/${requestId}`);
  await ref.update({
    target_sim_id: nextSimId,
    status: 'pending',
    attempt,
    picked_by: null,
    picked_at: null,
    failure_reason: null,
  });
};

// Listen for status changes on a specific OTP request
// Returns a promise that resolves with the final status
const waitForSmsStatus = (businessId, requestId, timeoutMs = 10000) => {
  const db = getFirebaseDB();

  // Dev mode: no Firebase → simulate success after 1s
  if (!db) {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ status: 'sent', simulated: true }), 1000);
    });
  }

  return new Promise((resolve) => {
    const ref = db.ref(`otp_requests/${businessId}/${requestId}/status`);
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        ref.off('value', listener);
        resolve({ status: 'timeout' });
      }
    }, timeoutMs);

    const listener = ref.on('value', (snapshot) => {
      const status = snapshot.val();
      if (settled) return;

      if (status === 'sent') {
        settled = true;
        clearTimeout(timeout);
        ref.off('value', listener);
        resolve({ status: 'sent' });
      } else if (status === 'failed') {
        settled = true;
        clearTimeout(timeout);
        ref.off('value', listener);
        resolve({ status: 'failed' });
      }
      // 'pending' and 'picked' — keep waiting
    });
  });
};

// Clean up old RTDB entries (call from cron or on startup)
const cleanupOldRequests = async (maxAgeMs = 300000) => {
  const db = getFirebaseDB();
  if (!db) return;

  const ref = db.ref('otp_requests');
  const snapshot = await ref.once('value');
  const data = snapshot.val();
  if (!data) return;

  const now = Date.now();
  const updates = {};

  for (const businessId of Object.keys(data)) {
    const requests = data[businessId];
    for (const reqId of Object.keys(requests)) {
      const entry = requests[reqId];
      // Only delete completed (sent/failed) entries older than maxAge
      // Skip pending/picked entries — they may still be in-flight
      if (now - entry.created_at > maxAgeMs && entry.status !== 'pending' && entry.status !== 'picked') {
        updates[`${businessId}/${reqId}`] = null; // delete
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await ref.update(updates);
    logger.info(`Cleaned up ${Object.keys(updates).length} old RTDB entries`);
  }
};

module.exports = { writeOtpRequest, retryWithNextSim, waitForSmsStatus, cleanupOldRequests };
