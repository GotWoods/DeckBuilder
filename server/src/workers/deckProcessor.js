require('dotenv').config();
const connectDB = require('../config/database');
const deckQueue = require('../utils/deckQueue');
const Deck = require('../models/deckSchema');
const logger = require('../config/logger');
const ProcessorRegistry = require('../utils/processorRegistry');
const { createBatches } = require('../utils/arrayUtils');

// Connect to MongoDB
connectDB();

const processorRegistry = new ProcessorRegistry();

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
      
      // Process batch with all registered processors in parallel
      const processors = processorRegistry.getProcessors();
      const results = await Promise.all(
        processors.map(processor => processor.processCards(batch.items))
      );

      // Transpose results so we get arrays per card instead of arrays per processor
      const cardResults = [];
      for (let i = 0; i < batch.items.length; i++) {
        cardResults[i] = results.map(processorResults => processorResults[i]);
      }
      
      // Update each card in the batch with pricing data
      for (let i = 0; i < batch.items.length; i++) {
        const card = batch.items[i];
        
        // Store CardResult objects directly
        card.pricing = {
          results: cardResults[i],
          processedAt: new Date()
        };
      }
      
      // Save the deck with updated pricing for this batch
      await deck.save();
      logger.info(`Batch ${batch.batchNumber} completed and saved`);
    }
    
    // Update deck status
    deck.Importing = false;
    await deck.save();
    
    // Count successful results across all cards by source
    const processors = processorRegistry.getProcessors();
    const resultCounts = {};
    
    processors.forEach(processor => {
      const source = processor.source;
      resultCounts[source] = deck.Cards.filter(c => 
        c.pricing?.results?.some(r => r.source === source && r.found)
      ).length;
    });
    
    const countSummary = Object.entries(resultCounts)
      .map(([source, count]) => `${count} found on ${source}`)
      .join(', ');
    
    logger.info(`Deck ${deckId} processing completed: ${countSummary}`);
    return { 
      success: true, 
      deckId, 
      cardsProcessed: deck.Cards.length,
      batchesProcessed: batches.length,
      processorResults: resultCounts
    };
    
  } catch (error) {
    logger.error(`Error processing deck ${job.data.deckId}:`, error);
    throw error;
  }
});

logger.info('Deck processor worker started');