const mongoose = require('mongoose');

const otpLogSchema = new mongoose.Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  recipient_mobile: { type: String, required: true },
  device_id: { type: String, required: true }, // browser/device fingerprint of the end user
  otp_hash: { type: String, required: true }, // SHA-256 of OTP
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'validated', 'expired'],
    default: 'pending',
  },
  sender_mobile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileNumber' },
  firebase_request_id: { type: String },
  attempts: { type: Number, default: 0 },
  failure_reason: { type: String },
  sms_sent_at: { type: Date },
  validated_at: { type: Date },
}, { timestamps: true });

otpLogSchema.index({ recipient_mobile: 1, createdAt: -1 });
otpLogSchema.index({ business_id: 1, createdAt: -1 });

module.exports = mongoose.model('OtpLog', otpLogSchema);
