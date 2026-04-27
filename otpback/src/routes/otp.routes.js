const router = require('express').Router();
const { authApiKey } = require('../middleware/authApiKey');
const { validateRequest } = require('../middleware/validateRequest');
const { generateOtpSchema, validateOtpSchema } = require('../validators/otp.validator');
const ctrl = require('../controllers/otp.controller');

router.use(authApiKey);

router.post('/generate', validateRequest(generateOtpSchema), ctrl.generate);
router.post('/validate', validateRequest(validateOtpSchema), ctrl.validate);

module.exports = router;
