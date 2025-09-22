import logger from '../config/logger';
import scryfallService from '../services/scryfallService';

/**
 * Analyze a card to extract its properties for alternative searching
 */
const analyzeCard = async (req, res) => {
  try {
    const { cardName } = req.params;

    if (!cardName || !cardName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Card name is required'
      });
    }

    logger.info(`Analyzing card: ${cardName}`);

    const analysis = await scryfallService.analyzeCard(cardName);

    res.status(200).json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error(`Error analyzing card ${req.params.cardName}:`, error);

    if (error.message.includes('Card not found')) {
      return res.status(404).json({
        success: false,
        error: `Card not found: ${req.params.cardName}`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze card'
    });
  }
};

/**
 * Search for alternative cards based on criteria
 */
const searchAlternatives = async (req, res) => {
  try {
    const criteria = req.body;
    const page = parseInt(req.query.page) || 1;
    const excludeCards = criteria.excludeCards || [];

    logger.info('Searching for alternative cards', {
      criteria: { ...criteria, excludeCards: excludeCards.length },
      page
    });

    const results = await scryfallService.searchCards(criteria, page);

    // Filter out cards that are already in the deck
    let filteredData = results.data;
    if (excludeCards.length > 0) {
      filteredData = results.data.filter(card => {
        const cardNameLower = card.name.toLowerCase();
        return !excludeCards.includes(cardNameLower);
      });

      logger.info(`Filtered ${results.data.length - filteredData.length} cards already in deck`);
    }

    res.status(200).json({
      success: true,
      data: filteredData,
      hasMore: results.hasMore,
      totalCards: filteredData.length,
      page: results.page,
      query: results.query,
      originalTotal: results.totalCards,
      excluded: results.data.length - filteredData.length
    });

  } catch (error) {
    logger.error('Error searching for alternative cards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search for alternative cards'
    });
  }
};

export default {
  analyzeCard,
  searchAlternatives
};