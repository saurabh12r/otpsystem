const Joi = require('joi');

const createBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  owner_name: Joi.string().min(2).max(100).required(),
  owner_email: Joi.string().email().optional().allow(''),
  owner_phone: Joi.string().pattern(/^\+?[1-9]\d{6,14}$/).required(),
  max_daily_otp: Joi.number().integer().min(10).max(10000).optional(),
});

const updateBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  owner_name: Joi.string().min(2).max(100).optional(),
  owner_email: Joi.string().email().optional().allow(''),
  owner_phone: Joi.string().pattern(/^\+?[1-9]\d{6,14}$/).optional(),
  is_active: Joi.boolean().optional(),
  is_verified: Joi.boolean().optional(),
  max_daily_otp: Joi.number().integer().min(10).max(10000).optional(),
}).min(1);

const addMobileNumberSchema = Joi.object({
  phone_number: Joi.string().pattern(/^\+?[1-9]\d{6,14}$/).required(),
  password: Joi.string().min(6).max(100).required(),
  label: Joi.string().max(50).optional(),
  priority: Joi.number().integer().min(1).max(10).optional(),
  daily_sms_limit: Joi.number().integer().min(10).max(500).optional(),
});

const updateMobileNumberSchema = Joi.object({
  phone_number: Joi.string().pattern(/^\+?[1-9]\d{6,14}$/).optional(),
  password: Joi.string().min(6).max(100).optional(),
  label: Joi.string().max(50).optional(),
  is_verified: Joi.boolean().optional(),
  is_active: Joi.boolean().optional(),
  priority: Joi.number().integer().min(1).max(10).optional(),
  daily_sms_limit: Joi.number().integer().min(10).max(500).optional(),
  fcm_token: Joi.string().optional(),
  device_id: Joi.string().optional(),
}).min(1);

module.exports = { createBusinessSchema, updateBusinessSchema, addMobileNumberSchema, updateMobileNumberSchema };
