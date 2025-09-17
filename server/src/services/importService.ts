import DeckModel from '../models/deckSchema';
import deckQueue from '../utils/deckQueue';
import logger from '../config/logger';

const importDeck = async (importData: string, userId: string | null = null) => {
  try {
    // Create and parse deck
    const deck = new DeckModel();
    deck.import(importData);

    // Associate with user if provided
    if (userId) {
      deck.userId = userId;
    }

    const savedDeck = await deck.save();

    logger.info(`Saved deck to database: ${savedDeck._id} for user: ${userId || 'anonymous'}`);

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

export {
  importDeck
};