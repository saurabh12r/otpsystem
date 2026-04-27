const config = require('../config');

const authAdmin = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token || token !== config.adminToken) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid admin token' });
  }
  next();
};

module.exports = { authAdmin };
