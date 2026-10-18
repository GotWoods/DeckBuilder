import logger from '../config/logger';
import ArbitrageScan from '../models/arbitrageScanSchema';
import ArbitrageOpportunity from '../models/arbitrageOpportunitySchema';
const arbitrageQueue = require('../utils/arbitrageQueue');

const DEFAULT_MIN_BUY_PRICE = 10;
const STALE_SCAN_MS = 15 * 60 * 1000;

// A scan with no progress for a while lost its worker; stop it blocking new scans
const failStaleScans = async () => {
  await ArbitrageScan.updateMany(
    { status: { $in: ['queued', 'running'] }, updatedAt: { $lt: new Date(Date.now() - STALE_SCAN_MS) } },
    { status: 'failed', error: 'Scan stalled', finishedAt: new Date() }
  );
};

const startScan = async (req, res) => {
  try {
    const minBuyPrice = parseFloat(req.body?.minBuyPrice ?? DEFAULT_MIN_BUY_PRICE);
    const maxCards = parseInt(req.body?.maxCards) || null;

    if (!(minBuyPrice > 0)) {
      return res.status(400).json({
        success: false,
        error: 'minBuyPrice must be greater than 0'
      });
    }

    await failStaleScans();
    const active = await ArbitrageScan.findOne({ status: { $in: ['queued', 'running'] } });
    if (active) {
      return res.status(409).json({
        success: false,
        error: 'A scan is already running',
        data: active
      });
    }

    const scan = await ArbitrageScan.create({
      minBuyPriceCents: Math.round(minBuyPrice * 100),
      maxCards,
      userId: req.user?.id
    });

    const job = await arbitrageQueue.add('scan', { scanId: scan._id.toString() });
    logger.info(`Arbitrage scan ${scan._id} queued with job ID: ${job.id}`);

    res.status(202).json({
      success: true,
      data: scan
    });
  } catch (error) {
    logger.error('Error starting arbitrage scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start arbitrage scan'
    });
  }
};

const getLatestScan = async (req, res) => {
  try {
    await failStaleScans();
    const scan = await ArbitrageScan.findOne().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: scan
    });
  } catch (error) {
    logger.error('Error retrieving arbitrage scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve arbitrage scan'
    });
  }
};

const getOpportunities = async (req, res) => {
  try {
    let { scanId } = req.query;

    if (!scanId) {
      // Latest scan with results, so a running scan shows rows as they arrive
      const scan = await ArbitrageScan.findOne({ status: { $in: ['running', 'done'] } }).sort({ createdAt: -1 });
      scanId = scan?._id;
    }

    const opportunities = scanId
      ? await ArbitrageOpportunity.find({ scanId }).sort({ marginCents: -1 })
      : [];

    res.status(200).json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });
  } catch (error) {
    logger.error('Error retrieving arbitrage opportunities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve arbitrage opportunities'
    });
  }
};

export default {
  startScan,
  getLatestScan,
  getOpportunities
};
