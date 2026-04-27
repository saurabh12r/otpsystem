const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { initFirebase } = require('./src/config/firebase');
const { cleanupOldRequests } = require('./src/services/firebase.service');
const { errorHandler } = require('./src/middleware/errorHandler');
const routes = require('./src/routes');
const logger = require('./src/utils/logger');

const app = express();

// Global rate limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { success: false, message: 'Too many requests, please try again later' },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false })); // allow inline scripts for admin UI
app.use(cors());

// Serve admin UI
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json());
app.use(limiter);

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Startup
const start = async () => {
  try {
    await connectDB();
    connectRedis();
    initFirebase();

    // Cleanup old RTDB entries every 5 minutes
    setInterval(() => {
      cleanupOldRequests().catch((err) => logger.error('RTDB cleanup error:', err.message));
    }, 5 * 60 * 1000);

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
