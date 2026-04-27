const businessService = require('../services/business.service');
const Business = require('../models/business.model');
const MobileNumber = require('../models/mobileNumber.model');
const OtpLog = require('../models/otpLog.model');

const createBusiness = async (req, res, next) => {
  try {
    const result = await businessService.createBusiness(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const listBusinesses = async (req, res, next) => {
  try {
    const businesses = await businessService.listBusinesses();
    res.json({ success: true, data: businesses });
  } catch (error) { next(error); }
};

const getBusinessById = async (req, res, next) => {
  try {
    const result = await businessService.getBusinessById(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const updateBusiness = async (req, res, next) => {
  try {
    const business = await businessService.updateBusiness(req.params.id, req.body);
    res.json({ success: true, data: business });
  } catch (error) { next(error); }
};

const refreshApiKey = async (req, res, next) => {
  try {
    const result = await businessService.refreshApiKey(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const toggleBusiness = async (req, res, next) => {
  try {
    const result = await businessService.toggleBusiness(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const addMobileNumber = async (req, res, next) => {
  try {
    const number = await businessService.addMobileNumber(req.params.id, req.body);
    res.status(201).json({ success: true, data: number });
  } catch (error) { next(error); }
};

const listMobileNumbers = async (req, res, next) => {
  try {
    const numbers = await businessService.listMobileNumbers(req.params.id);
    res.json({ success: true, data: numbers });
  } catch (error) { next(error); }
};

const updateMobileNumber = async (req, res, next) => {
  try {
    const number = await businessService.updateMobileNumber(req.params.numberId, req.body);
    res.json({ success: true, data: number });
  } catch (error) { next(error); }
};

const deleteMobileNumber = async (req, res, next) => {
  try {
    const result = await businessService.deleteMobileNumber(req.params.numberId);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};

const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [businessCount, numberCount, otpTodayCount, otpSentToday, otpFailedToday] = await Promise.all([
      Business.countDocuments(),
      MobileNumber.countDocuments(),
      OtpLog.countDocuments({ createdAt: { $gte: today } }),
      OtpLog.countDocuments({ createdAt: { $gte: today }, status: 'sent' }),
      OtpLog.countDocuments({ createdAt: { $gte: today }, status: 'failed' }),
    ]);

    res.json({
      success: true,
      data: {
        total_businesses: businessCount,
        total_numbers: numberCount,
        otp_today: otpTodayCount,
        otp_sent_today: otpSentToday,
        otp_failed_today: otpFailedToday,
      },
    });
  } catch (error) { next(error); }
};

module.exports = {
  createBusiness, listBusinesses, getBusinessById, updateBusiness,
  refreshApiKey, toggleBusiness,
  addMobileNumber, listMobileNumbers, updateMobileNumber, deleteMobileNumber,
  getDashboard,
};
