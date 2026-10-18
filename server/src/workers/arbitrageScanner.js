const arbitrageQueue = require('../utils/arbitrageQueue');
const ArbitrageScan = require('../models/arbitrageScanSchema');
const ArbitrageOpportunity = require('../models/arbitrageOpportunitySchema');
const logger = require('../config/logger');
const ProcessorRegistry = require('../utils/processorRegistry');
const FaceToFaceBuylist = require('./buylists/faceToFaceBuylist');
const TapsBuylist = require('./buylists/tapsBuylist');
const { createBatches } = require('../utils/arrayUtils');
const { normalizeName, frontFace } = require('../utils/cardIdentity');
const { findOpportunities } = require('../utils/arbitrageMatcher');

const processorRegistry = new ProcessorRegistry();
const buylists = [new FaceToFaceBuylist(), new TapsBuylist()];

const NAME_DELAY_MS = 500;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Group buylist entries by card name, highest buy price first
 */
function groupByName(entries) {
  const groups = new Map();

  entries.forEach(entry => {
    const key = normalizeName(entry.name);
    if (!groups.has(key)) {
      groups.set(key, { name: frontFace(entry.name), entries: [] });
    }
    groups.get(key).entries.push(entry);
  });

  const topBuy = (group) => Math.max(...group.entries.map(entry => entry.buyCashCents));
  return [...groups.values()].sort((a, b) => topBuy(b) - topBuy(a));
}

/**
 * Search every vendor for a card and return normalized sell listings
 */
async function fetchListings(cardName) {
  const processors = processorRegistry.getProcessors();
  const results = await Promise.all(processors.map(processor => processor.searchCard(cardName)));

  return results.flatMap((result, index) =>
    (result.prices || []).flatMap(raw => processors[index].toListings(raw))
  );
}

arbitrageQueue.process('scan', async (job) => {
  const { scanId } = job.data;
  const scan = await ArbitrageScan.findById(scanId);
  if (!scan) {
    throw new Error(`Arbitrage scan ${scanId} not found`);
  }

  logger.info(`Starting arbitrage scan ${scanId} (min buy price ${scan.minBuyPriceCents} cents)`);
  scan.status = 'running';
  scan.startedAt = new Date();
  await scan.save();

  const entries = (await Promise.all(
    buylists.map(buylist => buylist.fetchBuylist({ minBuyPriceCents: scan.minBuyPriceCents }))
  )).flat();

  let groups = groupByName(entries);
  if (scan.maxCards > 0) {
    groups = groups.slice(0, scan.maxCards);
  }

  scan.counts.buylistEntries = entries.length;
  scan.counts.cardNames = groups.length;
  scan.progress = { processed: 0, total: groups.length };
  await scan.save();
  logger.info(`Arbitrage scan ${scanId}: ${entries.length} buylist entries across ${groups.length} card names`);

  let opportunityCount = 0;

  for (const batch of createBatches(groups, 5)) {
    const opportunities = [];

    for (const group of batch.items) {
      const listings = await fetchListings(group.name);
      opportunities.push(...findOpportunities(group.entries, listings));
      await delay(NAME_DELAY_MS);
    }

    if (opportunities.length > 0) {
      await ArbitrageOpportunity.insertMany(opportunities.map(opportunity => ({ ...opportunity, scanId })));
      opportunityCount += opportunities.length;
    }

    scan.progress.processed += batch.size;
    scan.counts.opportunities = opportunityCount;
    await scan.save();
    logger.info(`Arbitrage scan ${scanId}: batch ${batch.batchNumber}/${batch.totalBatches} done, ${opportunityCount} opportunities so far`);
  }

  scan.status = 'done';
  scan.finishedAt = new Date();
  await scan.save();
  logger.info(`Arbitrage scan ${scanId} completed with ${opportunityCount} opportunities`);

  return { success: true, scanId, opportunities: opportunityCount };
});

logger.info('Arbitrage scanner registered');
