const bcrypt = require('bcrypt');
const Business = require('../models/business.model');
const MobileNumber = require('../models/mobileNumber.model');
const { generateApiKey } = require('../utils/generateApiKey');

const createBusiness = async (data) => {
  const { key, prefix } = generateApiKey();
  const hashedKey = await bcrypt.hash(key, 10);

  const business = await Business.create({
    ...data,
    api_key: hashedKey,
    api_key_prefix: prefix,
  });

  return {
    business: {
      _id: business._id,
      name: business.name,
      owner_name: business.owner_name,
      owner_email: business.owner_email,
      owner_phone: business.owner_phone,
      is_active: business.is_active,
      is_verified: business.is_verified,
      max_daily_otp: business.max_daily_otp,
      createdAt: business.createdAt,
    },
    api_key: key, // return plain key only once at creation
  };
};

const listBusinesses = async () => {
  return Business.find({}, '-api_key').sort({ createdAt: -1 });
};

const getBusinessById = async (id) => {
  const business = await Business.findById(id, '-api_key');
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  const numbers = await MobileNumber.find({ business_id: id }, '-password').sort({ priority: 1 });
  return { business, mobile_numbers: numbers };
};

const updateBusiness = async (id, data) => {
  const business = await Business.findByIdAndUpdate(id, data, { new: true, select: '-api_key' });
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  return business;
};

const refreshApiKey = async (id) => {
  const business = await Business.findById(id);
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });

  const { key, prefix } = generateApiKey();
  const hashedKey = await bcrypt.hash(key, 10);

  business.api_key = hashedKey;
  business.api_key_prefix = prefix;
  await business.save();

  return { api_key: key }; // return new plain key only once
};

const toggleBusiness = async (id) => {
  const business = await Business.findById(id);
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });
  business.is_active = !business.is_active;
  await business.save();
  return { is_active: business.is_active };
};

// Mobile number management
const addMobileNumber = async (businessId, data) => {
  const business = await Business.findById(businessId);
  if (!business) throw Object.assign(new Error('Business not found'), { statusCode: 404 });

  const existing = await MobileNumber.findOne({ phone_number: data.phone_number });
  if (existing) throw Object.assign(new Error('Phone number already registered. Each number can only belong to one business.'), { statusCode: 409 });

  // Hash password for APK login
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }

  // Admin-added numbers are auto-verified
  const created = await MobileNumber.create({ ...data, business_id: businessId, is_verified: true });
  const safe = created.toObject();
  delete safe.password;
  return safe;
};

const listMobileNumbers = async (businessId) => {
  return MobileNumber.find({ business_id: businessId }, '-password').sort({ priority: 1 });
};

const updateMobileNumber = async (numberId, data) => {
  // Hash password if being updated
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }
  const number = await MobileNumber.findByIdAndUpdate(numberId, data, { new: true, select: '-password' });
  if (!number) throw Object.assign(new Error('Mobile number not found'), { statusCode: 404 });
  return number;
};

const deleteMobileNumber = async (numberId) => {
  const number = await MobileNumber.findByIdAndDelete(numberId);
  if (!number) throw Object.assign(new Error('Mobile number not found'), { statusCode: 404 });
  return { message: 'Mobile number deleted' };
};

module.exports = {
  createBusiness, listBusinesses, getBusinessById, updateBusiness,
  refreshApiKey, toggleBusiness,
  addMobileNumber, listMobileNumbers, updateMobileNumber, deleteMobileNumber,
};
