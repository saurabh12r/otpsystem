const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { authAdmin } = require('../middleware/authAdmin');
const { validateRequest } = require('../middleware/validateRequest');
const { createBusinessSchema, updateBusinessSchema, addMobileNumberSchema, updateMobileNumberSchema } = require('../validators/admin.validator');
const ctrl = require('../controllers/admin.controller');

// Rate limit admin login: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, try again later' },
});

// Admin login (no auth required, rate limited)
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === config.adminUsername && password === config.adminPassword) {
    return res.json({ success: true, token: config.adminToken });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.use(authAdmin);

// Dashboard stats
router.get('/dashboard', ctrl.getDashboard);

// Business CRUD
router.post('/businesses', validateRequest(createBusinessSchema), ctrl.createBusiness);
router.get('/businesses', ctrl.listBusinesses);
router.get('/businesses/:id', ctrl.getBusinessById);
router.patch('/businesses/:id', validateRequest(updateBusinessSchema), ctrl.updateBusiness);
router.post('/businesses/:id/refresh-key', ctrl.refreshApiKey);
router.post('/businesses/:id/toggle', ctrl.toggleBusiness);

// Mobile number management
router.post('/businesses/:id/numbers', validateRequest(addMobileNumberSchema), ctrl.addMobileNumber);
router.get('/businesses/:id/numbers', ctrl.listMobileNumbers);
router.patch('/numbers/:numberId', validateRequest(updateMobileNumberSchema), ctrl.updateMobileNumber);
router.delete('/numbers/:numberId', ctrl.deleteMobileNumber);

module.exports = router;
