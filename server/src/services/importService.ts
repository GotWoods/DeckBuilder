import DeckModel from '../models/deckSchema';
import deckQueue from '../utils/deckQueue';
import logger from '../config/logger';

const importDeck = async (importData: string, userId: string | null = null, deckName?: string) => {
  try {
    logger.info('Import service called with:', { deckName, userId, importDataLength: importData?.length });

    // Create and parse deck
    const deck = new DeckModel({
      name: deckName
    });

    logger.info('Deck created with name:', { name: deck.name });

    deck.import(importData);

    logger.info('After import method, deck name is:', { name: deck.name });

    // Associate with user if provided
    if (userId) {
      deck.userId = userId;
    }

    logger.info('About to save deck:', { name: deck.name, userId: deck.userId, cardsCount: deck.Cards?.length });
    const savedDeck = await deck.save();

    logger.info(`Saved deck to database: ${savedDeck._id} for user: ${userId || 'anonymous'}`);

    // Add job to processing queue
    const job = await deckQueue.add('processDeck', {
      deckId: savedDeck._id
    }, {
      attempts: 3,
      backoff: { type: 'exponential' },
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