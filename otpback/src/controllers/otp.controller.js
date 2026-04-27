const otpService = require('../services/otp.service');

const generate = async (req, res, next) => {
  try {
    const { mobile_number, device_id } = req.body;
    const result = await otpService.generate(req.business._id.toString(), mobile_number, device_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const validate = async (req, res, next) => {
  try {
    const { mobile_number, otp, device_id } = req.body;
    const result = await otpService.validate(req.business._id.toString(), mobile_number, otp, device_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { generate, validate };
