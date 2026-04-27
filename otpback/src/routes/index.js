const router = require('express').Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/otp', require('./otp.routes'));

module.exports = router;
