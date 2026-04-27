const MobileNumber = require('../models/mobileNumber.model');
const redisService = require('./redis.service');
const firebaseService = require('./firebase.service');
const { getFirebaseDB } = require('../config/firebase');
const logger = require('../utils/logger');

const PER_SIM_TIMEOUT = 10000; // 10 seconds per SIM attempt
const MAX_TOTAL_TIMEOUT = 30000; // 30 seconds total
const HEARTBEAT_MAX_AGE = 2 * 60 * 1000; // 2 minutes

// Check if a SIM's APK is online via RTDB heartbeat
const isSimOnline = async (businessId, simId) => {
  const db = getFirebaseDB();
  if (!db) return true; // dev mode — assume online

  try {
    const snap = await db.ref(`device_status/${businessId}/${simId}`).once('value');
    const data = snap.val();
    if (!data || !data.online) return false;
    if (!data.last_heartbeat) return false;
    return (Date.now() - data.last_heartbeat) < HEARTBEAT_MAX_AGE;
  } catch (e) {
    logger.warn(`Failed to check online status for SIM ${simId}: ${e.message}`);
    return false;
  }
};

// Select eligible SIMs for a business — online SIMs first, then by priority
const selectSims = async (businessId) => {
  const sims = await MobileNumber.find({
    business_id: businessId,
    is_active: true,
    is_verified: true,
  }).sort({ priority: 1 });

  // Filter out SIMs that hit their daily limit, check online status
  const online = [];
  const offline = [];
  for (const sim of sims) {
    const count = await redisService.getSimCount(sim._id.toString());
    if (count >= sim.daily_sms_limit) continue;

    const simOnline = await isSimOnline(businessId, sim._id.toString());
    if (simOnline) {
      online.push(sim);
    } else {
      offline.push(sim);
    }
  }

  // Online SIMs first (they'll respond), then offline as fallback
  return [...online, ...offline];
};

// Orchestrate sending OTP with failover across multiple SIMs
// Returns { success, sender_sim_id, request_id } or throws
const sendOtpViaSim = async (businessId, recipient, message) => {
  const sims = await selectSims(businessId);

  if (sims.length === 0) {
    throw Object.assign(new Error('No active sender phones available for this business'), { statusCode: 503 });
  }

  const { v4: uuidv4 } = require('uuid');
  const requestId = uuidv4();

  // Store failover state in Redis
  await redisService.storePendingState(requestId, {
    business_id: businessId,
    recipient,
    sim_queue: sims.map((s) => s._id.toString()),
    current_index: 0,
  });

  const startTime = Date.now();

  for (let i = 0; i < sims.length; i++) {
    // Check total timeout
    if (Date.now() - startTime > MAX_TOTAL_TIMEOUT) {
      logger.warn(`Total timeout exceeded for request ${requestId}`);
      break;
    }

    const sim = sims[i];
    const simId = sim._id.toString();
    logger.info(`Attempting SIM ${simId} (${sim.phone_number}) for request ${requestId}, attempt ${i + 1}`);

    // Write to Firebase RTDB
    await firebaseService.writeOtpRequest(businessId, requestId, {
      recipient,
      message,
      targetSimId: simId,
      attempt: i + 1,
    });

    // Wait for SMS status from APK
    const result = await firebaseService.waitForSmsStatus(businessId, requestId, PER_SIM_TIMEOUT);

    if (result.status === 'sent' || result.simulated) {
      // Success! Increment counters
      await redisService.incrementSimCount(simId);
      await redisService.incrementBusinessDaily(businessId);
      await redisService.deletePendingState(requestId);

      logger.info(`OTP sent successfully via SIM ${sim.phone_number} for request ${requestId}`);
      return { success: true, sender_sim_id: sim._id, request_id: requestId };
    }

    // Failed or timed out — try next SIM
    logger.warn(`SIM ${sim.phone_number} ${result.status} for request ${requestId}`);

    if (i < sims.length - 1) {
      // Retry with next SIM
      await firebaseService.retryWithNextSim(businessId, requestId, sims[i + 1]._id.toString(), i + 2);
    }
  }

  // All SIMs exhausted
  await redisService.deletePendingState(requestId);
  throw Object.assign(new Error('All sender phones failed to send OTP'), { statusCode: 503 });
};

module.exports = { selectSims, sendOtpViaSim };
