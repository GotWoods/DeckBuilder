const Deck = require('../models/deckSchema');
const deckQueue = require('../utils/deckQueue');
const logger = require('../config/logger');

const importDeck = async (importData) => {
  try {
    // Create and parse deck
    const deck = new Deck();
    deck.import(importData);
    const savedDeck = await deck.save();

    logger.info('Saved deck to database:', savedDeck._id);
    
    // Add job to processing queue
    const job = await deckQueue.add('processDeck', { 
      deckId: savedDeck._id 
    }, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000
    });
    
    logger.info(`Added deck processing job: ${job.id}`);
    
    return {
      deckId: savedDeck._id,
      jobId: job.id
    };
  } catch (error) {
    logger.error('Error in deck service:', error);
    throw new Error('Failed to save deck to database');
  }
};

module.exports = {
  importDeck
};