const router = require('express').Router();
const mongoose = require('mongoose');
const { getRedis } = require('../config/redis');
const { getFirebaseDB } = require('../config/firebase');

router.get('/', async (req, res) => {
  const redis = getRedis();
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch (e) { /* redis down */ }

  res.json({
    success: true,
    status: 'ok',
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
      firebase: getFirebaseDB() ? 'connected' : 'not initialized',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
