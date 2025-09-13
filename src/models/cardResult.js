/**
 * Standard card result structure returned by all processors
 */
class CardResult {
  /**
   * @param {Object} options
   * @param {string} options.name - Card name
   * @param {number} options.quantity - Quantity requested
   * @param {number|null} options.price - Price in cents (null if not found)
   * @param {string|null} options.set - Set/expansion name (null if not found)
   * @param {string|null} options.condition - Card condition (NM, LP, MP, HP, etc.)
   * @param {boolean} options.inStock - Whether the card is in stock
   * @param {string} options.source - Processor source (e.g., 'facetoface', 'taps')
   * @param {string|null} options.url - URL to product page (null if not available)
   */
  constructor(options = {}) {
    this.name = options.name || '';
    this.quantity = options.quantity || 0;
    this.price = options.hasOwnProperty('price') ? options.price : null; // Price in cents
    this.set = options.set || null;
    this.condition = options.condition || null;
    this.inStock = options.inStock || false;
    this.source = options.source || 'unknown';
    this.url = options.url || null;
    this.found = options.hasOwnProperty('price') && options.price !== null && options.price !== undefined;
  }

  /**
   * Get price in dollars (formatted)
   * @returns {string|null} Price formatted as "$X.XX" or null if not found
   */
  getPriceFormatted() {
    if (this.price === null || this.price === undefined) return null;
    return `$${(this.price / 100).toFixed(2)}`;
  }

  /**
   * Create a CardResult for a card that was not found
   * @param {string} name - Card name
   * @param {number} quantity - Quantity requested
   * @param {string} source - Processor source
   * @returns {CardResult}
   */
  static notFound(name, quantity, source) {
    return new CardResult({
      name,
      quantity,
      source,
      inStock: false,
      found: false
    });
  }

  /**
   * Validate required properties
   * @returns {boolean}
   */
  isValid() {
    return !!this.name && 
           typeof this.quantity === 'number' && 
           this.quantity > 0 &&
           !!this.source &&
           this.source !== 'unknown';
  }
}

module.exports = CardResult;