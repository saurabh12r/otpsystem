const bcrypt = require('bcrypt');
const Business = require('../models/business.model');

const authApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key is required' });
    }

    const prefix = apiKey.substring(0, 11);
    const business = await Business.findOne({ api_key_prefix: prefix });
    if (!business) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    const isMatch = await bcrypt.compare(apiKey, business.api_key);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid API key' });
    }

    if (!business.is_active) {
      return res.status(403).json({ success: false, message: 'Business account is disabled' });
    }

    if (!business.is_verified) {
      return res.status(403).json({ success: false, message: 'Business account is not verified yet' });
    }

    req.business = business;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authApiKey };
