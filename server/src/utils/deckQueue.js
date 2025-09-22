const Bull = require('bull');
const redisConfig = require('../config/redis');
const logger = require('../config/logger');

const deckQueue = new Bull('deck processing', {
  redis: redisConfig,
  settings: {
    stalledInterval: 30000,    // Check for stalled jobs every 30 seconds (default: 30s)
    maxStalledCount: 1,        // Max number of times a job can be recovered (default: 1)
    retryProcessDelay: 5000,   // Delay before retrying a failed job (default: 5s)
    delayedDebounce: 1000,     // Debounce delayed jobs (default: 1s)
    drainDelay: 30000          // Delay when no jobs available - 30 seconds for very low usage (default: 5ms)
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    timeout: 2 * 60 * 60 * 1000  // 2 hours timeout
  }
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

deckQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled and will be retried`);
});

// Handle job timeouts and cleanup
deckQueue.on('failed', async (job, err) => {
  if (err.message.includes('job stalled more than allowable limit') ||
      err.message.includes('job timed out') ||
      err.name === 'TimeoutError') {
    logger.warn(`Job ${job.id} timed out after 2 hours, cleaning up deck`);

    try {
      const Deck = require('../models/deckSchema');
      const deckId = job.data.deckId;

      // Reset deck to allow re-processing
      await Deck.findByIdAndUpdate(deckId, {
        Importing: false
      });

      logger.info(`Reset deck ${deckId} after timeout, ready for re-import`);
    } catch (cleanupError) {
      logger.error(`Failed to cleanup timed-out deck:`, cleanupError);
    }
  }
});

module.exports = deckQueue;