const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUrl);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
