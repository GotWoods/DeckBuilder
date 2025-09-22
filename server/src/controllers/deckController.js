import logger from '../config/logger';
import Deck from '../models/deckSchema';
const deckQueue = require('../utils/deckQueue');

const getAll = async (req, res) => {
  try {
    const userId = req.user?.id;
    logger.info(`Retrieving decks from database for user: ${userId || 'anonymous'}`);

    // Filter by user if authenticated, otherwise show all (backwards compatibility)
    const filter = userId ? { userId } : {};
    const decks = await Deck.find(filter).sort({ createdAt: -1 });

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
    const userId = req.user?.id;

    logger.info(`Retrieving deck with ID: ${id} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: id, userId } : { _id: id };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found or access denied`);
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

const markCardPurchased = async (req, res) => {
  try {
    const { deckId, cardIndex } = req.params;
    const userId = req.user?.id;

    logger.info(`Marking card ${cardIndex} as purchased in deck ${deckId} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: deckId, userId } : { _id: deckId };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${deckId} not found or access denied`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    const cardIdx = parseInt(cardIndex);
    if (cardIdx < 0 || cardIdx >= deck.Cards.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card index'
      });
    }

    // Toggle the purchased status
    const newPurchasedStatus = !deck.Cards[cardIdx].purchased;
    deck.Cards[cardIdx].purchased = newPurchasedStatus;
    await deck.save();

    logger.info(`Card ${cardIndex} marked as ${newPurchasedStatus ? 'purchased' : 'not purchased'} in deck ${deckId}`);

    res.status(200).json({
      success: true,
      message: `Card marked as ${newPurchasedStatus ? 'purchased' : 'not purchased'}`,
      data: { purchased: newPurchasedStatus }
    });

  } catch (error) {
    logger.error('Error marking card as purchased:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark card as purchased'
    });
  }
};

const refreshPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info(`Refreshing price for deck with ID: ${id} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: id, userId } : { _id: id };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found or access denied`);
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

const updateSelectedPricing = async (req, res) => {
  try {
    const { deckId, cardIndex } = req.params;
    const { vendor, resultIndex } = req.body;
    const userId = req.user?.id;

    logger.info(`Updating selected pricing for card ${cardIndex} in deck ${deckId} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: deckId, userId } : { _id: deckId };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${deckId} not found or access denied`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    const cardIdx = parseInt(cardIndex);
    if (cardIdx < 0 || cardIdx >= deck.Cards.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card index'
      });
    }

    const card = deck.Cards[cardIdx];
    if (!card.pricing || !card.pricing.results) {
      return res.status(400).json({
        success: false,
        error: 'No pricing data available for this card'
      });
    }

    // Clear all existing selections for this card
    card.pricing.results.forEach(result => {
      result.selected = false;
    });

    // Find and select the specified result
    // First, group results by vendor to match frontend logic
    const groupedByVendor = card.pricing.results.reduce((groups, result) => {
      if (!groups[result.source]) {
        groups[result.source] = [];
      }
      groups[result.source].push(result);
      return groups;
    }, {});

    // Sort each vendor's results by price (to match frontend)
    Object.keys(groupedByVendor).forEach(vendorKey => {
      groupedByVendor[vendorKey].sort((a, b) => a.price - b.price);
    });

    // Find the specific result using vendor and vendor-specific index
    let targetResult = null;
    if (groupedByVendor[vendor] && groupedByVendor[vendor][resultIndex]) {
      targetResult = groupedByVendor[vendor][resultIndex];
    }

    if (!targetResult) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vendor or result index'
      });
    }

    // Find this result in the original results array and select it
    let foundResult = false;
    card.pricing.results.forEach(result => {
      if (result === targetResult) {
        result.selected = true;
        foundResult = true;
      }
    });

    if (!foundResult) {
      return res.status(400).json({
        success: false,
        error: 'Result not found in pricing data'
      });
    }

    await deck.save();

    logger.info(`Selected pricing updated for card ${cardIndex} in deck ${deckId}`);

    res.status(200).json({
      success: true,
      message: 'Selected pricing updated successfully'
    });

  } catch (error) {
    logger.error('Error updating selected pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update selected pricing'
    });
  }
};

const deleteDeck = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info(`Deleting deck with ID: ${id} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: id, userId } : { _id: id };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found or access denied`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    // Delete the deck
    await Deck.deleteOne({ _id: id });

    logger.info(`Deck with ID ${id} deleted successfully`);

    res.status(200).json({
      success: true,
      message: 'Deck deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting deck:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete deck'
    });
  }
};

const substituteCard = async (req, res) => {
  try {
    const { deckId, cardIndex } = req.params;
    const { selectedCard } = req.body;
    const userId = req.user?.id;

    logger.info(`Substituting card ${cardIndex} in deck ${deckId} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: deckId, userId } : { _id: deckId };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${deckId} not found or access denied`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    const cardIdx = parseInt(cardIndex);
    if (cardIdx < 0 || cardIdx >= deck.Cards.length) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card index'
      });
    }

    // Validate the selected card data
    if (!selectedCard || !selectedCard.name) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card data provided'
      });
    }

    const originalCard = deck.Cards[cardIdx];

    // Update the card with new data while preserving quantity and purchased status
    deck.Cards[cardIdx] = {
      name: selectedCard.name,
      quantity: originalCard.quantity || 1,
      purchased: originalCard.purchased || false,
      // Clear pricing data since this is a new card
      pricing: null
    };

    await deck.save();

    logger.info(`Card ${cardIndex} substituted with "${selectedCard.name}" in deck ${deckId}`);

    res.status(200).json({
      success: true,
      message: 'Card substituted successfully',
      data: deck.Cards[cardIdx]
    });

  } catch (error) {
    logger.error('Error substituting card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to substitute card'
    });
  }
};

const resetImportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    logger.info(`Resetting import status for deck ${id} for user: ${userId || 'anonymous'}`);

    // Find deck and check ownership if user is authenticated
    const filter = userId ? { _id: id, userId } : { _id: id };
    const deck = await Deck.findOne(filter);

    if (!deck) {
      logger.warn(`Deck with ID ${id} not found or access denied`);
      return res.status(404).json({
        success: false,
        error: 'Deck not found'
      });
    }

    // Reset the import status
    deck.Importing = false;
    await deck.save();

    logger.info(`Reset import status for deck ${id}`);

    res.status(200).json({
      success: true,
      message: 'Import status reset successfully, deck is ready for re-processing'
    });

  } catch (error) {
    logger.error('Error resetting import status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset import status'
    });
  }
};

export default {
  getAll,
  getById,
  markCardPurchased,
  refreshPricing,
  updateSelectedPricing,
  deleteDeck,
  substituteCard,
  resetImportStatus
};