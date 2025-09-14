import logger from '../config/logger';
import Deck from '../models/deckSchema';

const getAll = async (req, res) => {
  try {
    logger.info('Retrieving all decks from database');
    
    const decks = await Deck.find({}).sort({ createdAt: -1 });
    
    logger.info(`Retrieved ${decks.length} decks from database`);
    
    res.status(200).json({
      success: true,
      count: decks.length,
      data: decks
    });
  } catch (error) {
    logger.error('Error retrieving decks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve decks'
    });
  }
};

export default {
  getAll
};