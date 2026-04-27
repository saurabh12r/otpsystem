const crypto = require('crypto');
const redisService = require('./redis.service');
const smsService = require('./sms.service');
const OtpLog = require('../models/otpLog.model');
const { generateOtp } = require('../utils/generateOtp');
const logger = require('../utils/logger');

const generate = async (businessId, mobileNumber, deviceId) => {
  // 1. Check business daily limit
  const dailyCount = await redisService.getBusinessDaily(businessId);
  const Business = require('../models/business.model');
  const business = await Business.findById(businessId);
  if (dailyCount >= business.max_daily_otp) {
    throw Object.assign(new Error('Daily OTP limit reached for this business'), { statusCode: 429 });
  }

  // 2. Set rate limit (atomic NX — prevents concurrent requests)
  const rateLimitSet = await redisService.setRateLimit(mobileNumber);
  if (!rateLimitSet) {
    throw Object.assign(new Error('Please wait before requesting another OTP'), { statusCode: 429 });
  }

  // 3. Generate OTP
  const otp = generateOtp();
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // 4. Store OTP in Redis
  const { v4: uuidv4 } = require('uuid');
  const requestId = uuidv4();
  await redisService.storeOtp(mobileNumber, otp, deviceId, businessId, requestId);

  // 5. Create OTP log
  const otpLog = await OtpLog.create({
    business_id: businessId,
    recipient_mobile: mobileNumber,
    device_id: deviceId,
    otp_hash: otpHash,
    status: 'pending',
    firebase_request_id: requestId,
  });

  // 6. Send via SIM (waits for confirmation)
  const message = `Your OTP is ${otp}. Valid for 60 seconds.`;

  try {
    const result = await smsService.sendOtpViaSim(businessId, mobileNumber, message);

    // Update log with success
    otpLog.status = 'sent';
    otpLog.sender_mobile_id = result.sender_sim_id;
    otpLog.sms_sent_at = new Date();
    await otpLog.save();

    return {
      success: true,
      message: 'OTP sent successfully',
      request_id: result.request_id,
      expires_in: redisService.OTP_TTL,
    };
  } catch (error) {
    // All SIMs failed — clean up so user can retry
    await redisService.deleteOtp(mobileNumber);
    await redisService.clearRateLimit(mobileNumber);

    otpLog.status = 'failed';
    otpLog.failure_reason = error.message;
    await otpLog.save();

    throw error;
  }
};

const validate = async (businessId, mobileNumber, otp, deviceId) => {
  // 1. Check brute force attempts
  const attempts = await redisService.getOtpAttempts(mobileNumber);
  if (attempts >= redisService.MAX_OTP_ATTEMPTS) {
    await redisService.deleteOtp(mobileNumber);
    await redisService.clearOtpAttempts(mobileNumber);
    throw Object.assign(new Error('Too many failed attempts. Please request a new OTP.'), { statusCode: 429 });
  }

  // 2. Get stored OTP
  const stored = await redisService.getStoredOtp(mobileNumber);
  if (!stored) {
    throw Object.assign(new Error('OTP expired or not found. Please request a new OTP.'), { statusCode: 400 });
  }

  // 3. Check device match
  if (stored.device_id !== deviceId) {
    throw Object.assign(new Error('Device mismatch. OTP must be validated from the same device.'), { statusCode: 400 });
  }

  // 4. Compare OTP
  if (stored.otp !== otp) {
    await redisService.incrementOtpAttempts(mobileNumber);
    throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 });
  }

  // 5. Success — cleanup
  await redisService.deleteOtp(mobileNumber);
  await redisService.clearRateLimit(mobileNumber);
  await redisService.clearOtpAttempts(mobileNumber);

  // Update log
  await OtpLog.findOneAndUpdate(
    { business_id: businessId, recipient_mobile: mobileNumber, status: 'sent' },
    { status: 'validated', validated_at: new Date() },
    { sort: { createdAt: -1 } }
  );

  return { success: true, message: 'OTP verified successfully' };
};

module.exports = { generate, validate };
