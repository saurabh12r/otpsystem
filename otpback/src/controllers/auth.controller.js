const bcrypt = require('bcrypt');
const MobileNumber = require('../models/mobileNumber.model');
const Business = require('../models/business.model');

const login = async (req, res, next) => {
  try {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }

    // Find mobile number
    const mobileNumber = await MobileNumber.findOne({ phone_number });
    if (!mobileNumber) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }

    // Check password
    if (!mobileNumber.password) {
      return res.status(401).json({ success: false, message: 'No password set for this number. Contact admin.' });
    }

    const isMatch = await bcrypt.compare(password, mobileNumber.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid phone number or password' });
    }

    // Check if number is active
    if (!mobileNumber.is_active) {
      return res.status(403).json({ success: false, message: 'This mobile number has been disabled' });
    }

    // Check business
    const business = await Business.findById(mobileNumber.business_id);
    if (!business) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }
    if (!business.is_active) {
      return res.status(403).json({ success: false, message: 'Business account is disabled' });
    }
    if (!business.is_verified) {
      return res.status(403).json({ success: false, message: 'Business account is not verified' });
    }

    res.json({
      success: true,
      data: {
        business_id: business._id,
        business_name: business.name,
        sim_id: mobileNumber._id,
        phone_number: mobileNumber.phone_number,
        label: mobileNumber.label,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login };
