import logger from '../config/logger';
import Deck from '../models/deckSchema';
const deckQueue = require('../utils/deckQueue');

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

const getById = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Retrieving deck with ID: ${id}`);

    const deck = await Deck.findById(id);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    logger.info(`Retrieved deck with ID: ${id}`);

    res.status(200).json({
      success: true,
      count: 1,
      data: deck
    });
  } catch (error) {
    logger.error('Error retrieving deck by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve deck'
    });
  }
};

const refreshPricing = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`Refreshing price for deck with ID: ${id}`);

    const deck = await Deck.findById(id);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    deck.Importing = true;
    await deck.save();

    const job = await deckQueue.add('processDeck', {
      deckId: id
    }, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000
    });

    logger.info(`Price refresh job queued for deck ${id} with job ID: ${job.id}`);

    res.status(200).json({
      success: true,
      message: 'Price refresh initiated',
      jobId: job.id
    });

  } catch (error) {
    logger.error('Error refreshing price for deck', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh deck pricing'
    });
  }
}

export default {
  getAll,
  getById,
  refreshPricing
};