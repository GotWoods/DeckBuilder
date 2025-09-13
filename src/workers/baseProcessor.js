const { CardResult } = require('../models/cardResult');

/**
 * Base class for card processors
 * Defines the contract that all processors must implement
 */
class BaseProcessor {
  /**
   * Process an array of cards and return standardized CardResult objects
   * @param {Array} cards - Array of card objects with Quantity and Name properties
   * @returns {Promise<Array<CardResult>>} Array of CardResult objects
   */
  async processCards(cards) {
    throw new Error('processCards method must be implemented by subclass');
  }

  /**
   * Create a CardResult for a card that was not found
   * @param {Object} card - Card with Name and Quantity properties
   * @param {string} source - Processor source identifier
   * @returns {CardResult}
   */
  createNotFoundResult(card, source) {
    return CardResult.notFound(card.Name, card.Quantity, source);
  }

  /**
   * Helper method for adding delays between API calls
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseProcessor;