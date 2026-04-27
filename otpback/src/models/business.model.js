const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner_name: { type: String, required: true, trim: true },
  owner_email: { type: String, trim: true, lowercase: true },
  owner_phone: { type: String, required: true, trim: true },
  api_key: { type: String, required: true }, // bcrypt hashed
  api_key_prefix: { type: String, required: true, index: true }, // first 11 chars for lookup
  is_active: { type: Boolean, default: true },
  is_verified: { type: Boolean, default: false },
  max_daily_otp: { type: Number, default: 500 },
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);
