const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis;

const connectRedis = () => {
  if (!config.redisUrl) {
    throw new Error('REDIS_URL not set');
  }
  redis = new Redis(config.redisUrl);
  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error('Redis error:', err.message));
  return redis;
};

const getRedis = () => {
  if (!redis) throw new Error('Redis not initialized');
  return redis;
};

module.exports = { connectRedis, getRedis };
