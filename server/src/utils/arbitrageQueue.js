const Bull = require('bull');
const redisConfig = require('../config/redis');
const logger = require('../config/logger');

const arbitrageQueue = new Bull('arbitrage scan', {
  redis: redisConfig,
  settings: {
    drainDelay: 30000
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 1, // A retry would repeat the whole crawl
    timeout: 6 * 60 * 60 * 1000
  }
});

arbitrageQueue.on('error', (error) => {
  logger.error('Arbitrage queue Redis error:', error);
});

arbitrageQueue.on('failed', async (job, err) => {
  logger.error(`Arbitrage scan job ${job.id} failed: ${err.message}`);

  try {
    const ArbitrageScan = require('../models/arbitrageScanSchema');
    await ArbitrageScan.findOneAndUpdate(
      { _id: job.data.scanId, status: { $in: ['queued', 'running'] } },
      { status: 'failed', error: err.message, finishedAt: new Date() }
    );
  } catch (cleanupError) {
    logger.error('Failed to mark arbitrage scan as failed:', cleanupError);
  }
});

module.exports = arbitrageQueue;
