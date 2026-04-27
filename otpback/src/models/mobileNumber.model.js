const mongoose = require('mongoose');

const mobileNumberSchema = new mongoose.Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  phone_number: { type: String, required: true, trim: true },
  label: { type: String, trim: true, default: 'Primary' },
  is_verified: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  priority: { type: Number, default: 1 },
  daily_sms_limit: { type: Number, default: 100 },
  password: { type: String }, // bcrypt hashed, set by admin for APK login
  fcm_token: { type: String },
  device_id: { type: String }, // unique device identifier of the phone running APK
}, { timestamps: true });

mobileNumberSchema.index({ business_id: 1, is_active: 1, is_verified: 1, priority: 1 });
mobileNumberSchema.index({ phone_number: 1 }, { unique: true }); // phone must be globally unique (APK login uses it)

module.exports = mongoose.model('MobileNumber', mobileNumberSchema);
