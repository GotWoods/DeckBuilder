require('dotenv').config();
const connectDB = require('../config/database');
const deckQueue = require('../utils/deckQueue');
const Deck = require('../models/deckSchema');
const logger = require('../config/logger');
const ProcessorRegistry = require('../utils/processorRegistry');
const { createBatches } = require('../utils/arrayUtils');
const Redis = require('redis');

// Dynamic import for ES6 module
let scryfallService = null;
(async () => {
  const module = await import('../services/scryfallService.js');
  scryfallService = module.default;
})();

// Connect to MongoDB
connectDB();

const processorRegistry = new ProcessorRegistry();

// Initialize Redis publisher for progress events
let redisPublisher = null;

async function initializeRedis() {
  try {
    redisPublisher = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisPublisher.connect();
    logger.info('Worker Redis publisher connected');
  } catch (error) {
    logger.error('Failed to connect Redis publisher:', error);
  }
}

// Progress publishing helpers
async function publishProgress(event) {
  if (!redisPublisher) {
    logger.warn('Redis publisher not initialized, cannot publish progress');
    return;
  }

  try {
    const message = JSON.stringify(event);
    logger.info(`Worker publishing progress: ${event.type} for deck ${event.deckId}`);
    await redisPublisher.publish('deck-progress', message);
    logger.info(`Successfully published to Redis: ${event.type}`);
  } catch (error) {
    logger.error('Error publishing progress:', error);
  }
}

async function publishStart(userId, deckId, totalCards) {
  await publishProgress({
    userId,
    deckId,
    type: 'start',
    progress: 0
  });
}

async function publishBatch(userId, deckId, batchNumber, totalBatches, cardsProcessed, totalCards) {
  const progress = Math.round((cardsProcessed / totalCards) * 100);

  await publishProgress({
    userId,
    deckId,
    type: 'batch',
    progress
  });
}

async function publishCard(userId, deckId, cardName, cardIndex, totalCards, resultsFound) {
  const progress = Math.round(((cardIndex + 1) / totalCards) * 100);

  await publishProgress({
    userId,
    deckId,
    type: 'card',
    progress
  });
}

async function publishComplete(userId, deckId, totalCards, processorResults) {
  await publishProgress({
    userId,
    deckId,
    type: 'complete',
    progress: 100
  });
}

async function publishError(userId, deckId, error) {
  await publishProgress({
    userId,
    deckId,
    type: 'error',
    message: error
  });
}

/**
 * Fetch color identity for a batch of cards using Scryfall
 */
async function fetchColorIdentityForCards(cards) {
  if (!scryfallService) {
    logger.warn('Scryfall service not initialized, skipping color identity lookup');
    return;
  }

  for (const card of cards) {
    // Skip if card already has color identity
    if (card.colorIdentity && card.colorIdentity.length > 0) {
      logger.debug(`Card "${card.Name}" already has color identity: ${card.colorIdentity.join('')}`);
      continue;
    }

    try {
      logger.info(`Fetching color identity for: ${card.Name}`);
      const cardData = await scryfallService.getCardData(card.Name);

      if (cardData && cardData.color_identity) {
        card.colorIdentity = cardData.color_identity;
        logger.info(`Color identity for "${card.Name}": ${card.colorIdentity.join('')}`);
      } else {
        logger.warn(`No color identity found for: ${card.Name}`);
        card.colorIdentity = [];
      }
    } catch (error) {
      logger.error(`Error fetching color identity for "${card.Name}":`, error.message);
      card.colorIdentity = [];
    }
  }
}

/**
 * Calculate deck color identity from all cards
 */
function calculateDeckColorIdentity(deck) {
  const colorSet = new Set();

  deck.Cards.forEach(card => {
    if (card.colorIdentity && Array.isArray(card.colorIdentity)) {
      card.colorIdentity.forEach(color => colorSet.add(color));
    }
  });

  const deckColorIdentity = Array.from(colorSet).sort();
  logger.info(`Calculated deck color identity: ${deckColorIdentity.join('')}`);
  return deckColorIdentity;
}

// Initialize Redis on startup
initializeRedis();

logger.info('Deck processor worker started');
logger.info('Setting up Bull queue processor...');

deckQueue.process('processDeck', async (job) => {
  logger.info('>>> JOB PROCESSOR FUNCTION CALLED <<<');
  try {
    const { deckId } = job.data;
    logger.info(`Processing deck: ${deckId}`);
    
    // Find the deck in the database
    const deck = await Deck.findById(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    
    logger.info(`Found deck with ${deck.Cards.length} cards`);

    // Filter out purchased cards before processing
    const unpurchasedCards = deck.Cards.filter(card => !card.purchased);
    logger.info(`Filtering to ${unpurchasedCards.length} unpurchased cards (skipping ${deck.Cards.length - unpurchasedCards.length} purchased cards)`);

    // Publish start event
    await publishStart(deck.userId, deckId, unpurchasedCards.length);

    // Process cards in batches of 5
    const batches = createBatches(unpurchasedCards, 5);
    logger.info(`Processing ${unpurchasedCards.length} cards in ${batches.length} batches of up to 5 cards each`);
    
    for (const batch of batches) {
      logger.info(`Processing batch ${batch.batchNumber}/${batch.totalBatches} (${batch.size} cards)`);

      // Publish batch start event
      const cardsProcessed = (batch.batchNumber - 1) * 5;
      await publishBatch(deck.userId, deckId, batch.batchNumber, batch.totalBatches, cardsProcessed, unpurchasedCards.length);

      // Fetch color identity for cards in this batch first
      await fetchColorIdentityForCards(batch.items);

      // Process batch with all registered processors in parallel
      const processors = processorRegistry.getProcessors();
      const results = await Promise.all(
        processors.map(processor => processor.processCards(batch.items))
      );

      // Log results from each processor
      for (let p = 0; p < processors.length; p++) {
        const processor = processors[p];
        const processorResults = results[p];
        logger.info(`Processor ${processor.source} returned ${processorResults.length} total results for batch ${batch.batchNumber}`);

        // Log per-card result counts for this processor
        for (let i = 0; i < batch.items.length; i++) {
          const card = batch.items[i];
          const cardResultsFromThisProcessor = processorResults.filter(r => r.name === card.Name);
          logger.debug(`${processor.source}: "${card.Name}" -> ${cardResultsFromThisProcessor.length} results`);
        }
      }

      // Transpose results so we get arrays per card instead of arrays per processor
      const cardResults = [];
      for (let i = 0; i < batch.items.length; i++) {
        cardResults[i] = results.flat().filter(r => r.name === batch.items[i].Name);
        logger.info(`Card "${batch.items[i].Name}" - Total combined results: ${cardResults[i].length}`);

        // Publish individual card progress
        const globalCardIndex = (batch.batchNumber - 1) * 5 + i;
        await publishCard(deck.userId, deckId, batch.items[i].Name, globalCardIndex, unpurchasedCards.length, cardResults[i].length);
      }
      
      // Update each card in the batch with pricing data
      for (let i = 0; i < batch.items.length; i++) {
        const card = batch.items[i];

        // Store CardResult objects directly
        card.pricing = {
          results: cardResults[i],
          processedAt: new Date()
        };

        logger.info(`Storing pricing for "${card.Name}": ${cardResults[i].length} results from sources: ${cardResults[i].map(r => r.source).join(', ')}`);
      }
      
      // Save the deck with updated pricing for this batch
      await deck.save();
      logger.info(`Batch ${batch.batchNumber} completed and saved`);
    }
    
    // Calculate and store deck color identity
    deck.colorIdentity = calculateDeckColorIdentity(deck);

    // Update deck status
    deck.Importing = false;
    await deck.save();
    
    // Count successful results across all cards by source
    const processors = processorRegistry.getProcessors();
    const resultCounts = {};
    const totalResultCounts = {};

    processors.forEach(processor => {
      const source = processor.source;
      resultCounts[source] = deck.Cards.filter(c =>
        c.pricing?.results?.some(r => r.source === source && r.found)
      ).length;
      totalResultCounts[source] = deck.Cards.reduce((sum, c) =>
        sum + (c.pricing?.results?.filter(r => r.source === source) || []).length, 0
      );
    });

    const countSummary = Object.entries(resultCounts)
      .map(([source, count]) => `${count} cards found on ${source}`)
      .join(', ');

    const totalCountSummary = Object.entries(totalResultCounts)
      .map(([source, count]) => `${count} total results from ${source}`)
      .join(', ');

    logger.info(`Deck ${deckId} processing completed: ${countSummary}`);
    logger.info(`Deck ${deckId} total results: ${totalCountSummary}`);

    // Publish completion event
    await publishComplete(deck.userId, deckId, unpurchasedCards.length, resultCounts);

    return {
      success: true,
      deckId,
      cardsProcessed: unpurchasedCards.length,
      batchesProcessed: batches.length,
      processorResults: resultCounts
    };

  } catch (error) {
    logger.error(`Error processing deck ${job.data.deckId}:`, error);

    // Try to get userId for error publishing
    try {
      const deck = await Deck.findById(job.data.deckId);
      await publishError(deck?.userId, job.data.deckId, error.message);
    } catch (publishErr) {
      logger.error('Failed to publish error event:', publishErr);
    }

    throw error;
  }
});

// Add explicit Redis connection test
setTimeout(async () => {
  logger.info('Checking queue status after 2 seconds...');
  try {
    const waiting = await deckQueue.getWaiting();
    const active = await deckQueue.getActive();
    logger.info(`Queue waiting jobs: ${waiting.length}`);
    logger.info(`Queue active jobs: ${active.length}`);
    logger.info('Queue appears to be working properly');
  } catch (error) {
    logger.error('Queue status check failed:', error.message);
    logger.error('This indicates a Redis connection problem');
  }
}, 2000);