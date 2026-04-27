const Joi = require('joi');

const generateOtpSchema = Joi.object({
  mobile_number: Joi.string()
    .pattern(/^\+?[1-9]\d{6,14}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid mobile number format. Use E.164 format (e.g., +919876543210)' }),
  device_id: Joi.string().min(5).max(256).required()
    .messages({ 'string.min': 'device_id must be at least 5 characters' }),
});

const validateOtpSchema = Joi.object({
  mobile_number: Joi.string()
    .pattern(/^\+?[1-9]\d{6,14}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid mobile number format' }),
  otp: Joi.string().length(6).pattern(/^\d{6}$/).required()
    .messages({ 'string.pattern.base': 'OTP must be exactly 6 digits' }),
  device_id: Joi.string().min(5).max(256).required(),
});

module.exports = { generateOtpSchema, validateOtpSchema };
