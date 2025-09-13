const Bull = require('bull');
const redisConfig = require('../config/redis');
const logger = require('../config/logger');

const deckQueue = new Bull('deck processing', {
  redis: redisConfig
});

// Log Redis connection events
deckQueue.on('ready', () => {
  logger.info(`Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
  logger.info('Bull queue system ready for job processing');
});

deckQueue.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

deckQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err.message);
});

deckQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed successfully`);
});

module.exports = deckQueue;