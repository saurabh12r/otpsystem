const { getRedis } = require('../config/redis');
const crypto = require('crypto');

const OTP_TTL = 60; // seconds
const RATE_TTL = 60;
const SMS_PENDING_TTL = 120;
const MAX_OTP_ATTEMPTS = 3;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// Rate limiting: returns true if rate limited (already sent within cooldown)
const isRateLimited = async (mobile) => {
  const redis = getRedis();
  const exists = await redis.exists(`rate:${mobile}`);
  return !!exists;
};

const setRateLimit = async (mobile) => {
  const redis = getRedis();
  // NX = set only if not exists (atomic)
  const result = await redis.set(`rate:${mobile}`, '1', 'EX', RATE_TTL, 'NX');
  return result === 'OK'; // true if set successfully (not rate limited)
};

const clearRateLimit = async (mobile) => {
  const redis = getRedis();
  await redis.del(`rate:${mobile}`);
};

// OTP storage
const storeOtp = async (mobile, otp, deviceId, businessId, requestId) => {
  const redis = getRedis();
  const data = JSON.stringify({ otp, device_id: deviceId, business_id: businessId, request_id: requestId });
  await redis.set(`otp:${mobile}`, data, 'EX', OTP_TTL);
};

const getStoredOtp = async (mobile) => {
  const redis = getRedis();
  const data = await redis.get(`otp:${mobile}`);
  return data ? JSON.parse(data) : null;
};

const deleteOtp = async (mobile) => {
  const redis = getRedis();
  await redis.del(`otp:${mobile}`);
};

// Brute force protection
const incrementOtpAttempts = async (mobile) => {
  const redis = getRedis();
  const key = `otp_attempts:${mobile}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, OTP_TTL);
  return count;
};

const getOtpAttempts = async (mobile) => {
  const redis = getRedis();
  const count = await redis.get(`otp_attempts:${mobile}`);
  return parseInt(count) || 0;
};

const clearOtpAttempts = async (mobile) => {
  const redis = getRedis();
  await redis.del(`otp_attempts:${mobile}`);
};

// SIM daily counter
const incrementSimCount = async (simId) => {
  const redis = getRedis();
  const date = new Date().toISOString().split('T')[0];
  const key = `sim_count:${simId}:${date}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 90000); // 25 hours
  return count;
};

const getSimCount = async (simId) => {
  const redis = getRedis();
  const date = new Date().toISOString().split('T')[0];
  const key = `sim_count:${simId}:${date}`;
  const count = await redis.get(key);
  return parseInt(count) || 0;
};

// Business daily counter
const incrementBusinessDaily = async (businessId) => {
  const redis = getRedis();
  const date = new Date().toISOString().split('T')[0];
  const key = `business_daily:${businessId}:${date}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 90000);
  return count;
};

const getBusinessDaily = async (businessId) => {
  const redis = getRedis();
  const date = new Date().toISOString().split('T')[0];
  const key = `business_daily:${businessId}:${date}`;
  const count = await redis.get(key);
  return parseInt(count) || 0;
};

// SMS pending state for failover
const storePendingState = async (requestId, data) => {
  const redis = getRedis();
  await redis.set(`sms_pending:${requestId}`, JSON.stringify(data), 'EX', SMS_PENDING_TTL);
};

const getPendingState = async (requestId) => {
  const redis = getRedis();
  const data = await redis.get(`sms_pending:${requestId}`);
  return data ? JSON.parse(data) : null;
};

const updatePendingState = async (requestId, data) => {
  const redis = getRedis();
  const ttl = await redis.ttl(`sms_pending:${requestId}`);
  await redis.set(`sms_pending:${requestId}`, JSON.stringify(data), 'EX', ttl > 0 ? ttl : SMS_PENDING_TTL);
};

const deletePendingState = async (requestId) => {
  const redis = getRedis();
  await redis.del(`sms_pending:${requestId}`);
};

module.exports = {
  OTP_TTL, RATE_TTL, MAX_OTP_ATTEMPTS,
  hashOtp,
  isRateLimited, setRateLimit, clearRateLimit,
  storeOtp, getStoredOtp, deleteOtp,
  incrementOtpAttempts, getOtpAttempts, clearOtpAttempts,
  incrementSimCount, getSimCount,
  incrementBusinessDaily, getBusinessDaily,
  storePendingState, getPendingState, updatePendingState, deletePendingState,
};
