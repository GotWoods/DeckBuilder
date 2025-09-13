const deckQueue = require('../utils/deckQueue');
const Deck = require('../models/deckSchema');
const logger = require('../config/logger');
const FaceToFaceProcessor = require('./faceToFaceProcessor');
const TapsProcessor = require('./tapsProcessor');
const { createBatches } = require('../utils/arrayUtils');

const f2fProcessor = new FaceToFaceProcessor();
const tapsProcessor = new TapsProcessor();

deckQueue.process('processDeck', async (job) => {
  try {
    const { deckId } = job.data;
    logger.info(`Processing deck: ${deckId}`);
    
    // Find the deck in the database
    const deck = await Deck.findById(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    
    logger.info(`Found deck with ${deck.Cards.length} cards`);
    
    // Process cards in batches of 5
    const batches = createBatches(deck.Cards, 5);
    logger.info(`Processing ${deck.Cards.length} cards in ${batches.length} batches of up to 5 cards each`);
    
    for (const batch of batches) {
      logger.info(`Processing batch ${batch.batchNumber}/${batch.totalBatches} (${batch.size} cards)`);
      
      // Process batch with both processors in parallel
      const [f2fResults, tapsResults] = await Promise.all([
        f2fProcessor.processCards(batch.items),
        tapsProcessor.processCards(batch.items)
      ]);
      
      // Update each card in the batch with pricing data
      for (let i = 0; i < batch.items.length; i++) {
        const card = batch.items[i];
        const f2fResult = f2fResults[i];
        const tapsResult = tapsResults[i];
        
        // Store CardResult objects directly - no need to convert
        card.pricing = {
          results: [f2fResult, tapsResult],
          processedAt: new Date()
        };
        
        // Log the results
        const f2fPrice = f2fResult.found ? f2fResult.getPriceFormatted() : 'Not found';
        const tapsPrice = tapsResult.found ? tapsResult.getPriceFormatted() : 'Not found';
        const f2fStock = f2fResult.inStock ? 'In Stock' : 'Out of Stock';
        const tapsStock = tapsResult.inStock ? 'In Stock' : 'Out of Stock';
        
        logger.info(`${card.Quantity}x ${card.Name}: F2F(${f2fPrice}, ${f2fStock}) Taps(${tapsPrice}, ${tapsStock})`);
      }
      
      // Save the deck with updated pricing for this batch
      await deck.save();
      logger.info(`Batch ${batch.batchNumber} completed and saved`);
      
      // Small delay between batches to be respectful to APIs
      if (batch.batchNumber < batch.totalBatches) {
        logger.info('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Update deck status
    deck.Importing = false;
    await deck.save();
    
    // Count successful results across all cards
    const f2fFoundCount = deck.Cards.filter(c => 
      c.pricing?.results?.some(r => r.source === 'facetoface' && r.found)
    ).length;
    const tapsFoundCount = deck.Cards.filter(c => 
      c.pricing?.results?.some(r => r.source === 'taps' && r.found)
    ).length;
    
    logger.info(`Deck ${deckId} processing completed: ${f2fFoundCount} found on F2F, ${tapsFoundCount} found on Taps`);
    return { 
      success: true, 
      deckId, 
      cardsProcessed: deck.Cards.length,
      batchesProcessed: batches.length,
      faceToFaceResults: f2fFoundCount,
      tapsResults: tapsFoundCount
    };
    
  } catch (error) {
    logger.error(`Error processing deck ${job.data.deckId}:`, error);
    throw error;
  }
});

// Handle job completion
deckQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed:`, result);
});

// Handle job failures
deckQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed:`, err.message);
});

logger.info('Deck processor worker started');