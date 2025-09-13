/**
 * Base class for card processors
 * Defines the contract that all processors must implement
 */
class BaseProcessor {
  /**
   * Process an array of cards and return enriched data
   * @param {Array} cards - Array of card objects with Quantity and Name properties
   * @returns {Promise<Array>} Array of processed card objects
   */
  async processCards(cards) {
    throw new Error('processCards method must be implemented by subclass');
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