const axios = require('axios');
const BaseProcessor = require('../processors/baseProcessor');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Base class for buylist crawlers. Subclasses supply source, vendorName,
 * fetchPage(page) returning the raw response body, and parsePage(data).
 */
class BaseBuylist extends BaseProcessor {
  constructor({ source, vendorName, pageDelayMs = 500, maxPages = 300 }) {
    super();
    this.source = source;
    this.vendorName = vendorName;
    this.pageDelayMs = pageDelayMs;
    this.maxPages = maxPages;
  }

  async get(url, params) {
    const response = await axios.get(url, {
      params,
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT }
    });
    return response.data;
  }

  /**
   * Walk the buylist from the highest buy price down, stopping below the threshold.
   * Never throws; a failed page ends the crawl with what was collected so far.
   */
  async fetchBuylist({ minBuyPriceCents = 1000 } = {}) {
    const entries = [];

    try {
      for (let page = 1; page <= this.maxPages; page++) {
        const result = this.parsePage(await this.fetchPage(page));
        if (result.rawCount === 0) break;

        entries.push(...result.entries.filter(entry => entry.buyCashCents >= minBuyPriceCents));
        this.logger.info(`${this.vendorName} buylist: page ${page} returned ${result.rawCount} products, ${entries.length} entries so far`);

        if (result.topBuyCents < minBuyPriceCents) break;
        if (page === this.maxPages) {
          this.logger.warn(`${this.vendorName} buylist: stopped at the ${this.maxPages} page limit before reaching the minimum buy price`);
        }
        await this.delay(this.pageDelayMs);
      }
    } catch (error) {
      this.logger.error(`Error fetching ${this.vendorName} buylist: ${error.message}`);
    }

    // Pages can overlap while the vendor's index is updating
    const unique = new Map();
    entries.forEach(entry => {
      const key = [entry.name, entry.set, entry.collectorNumber, entry.finish, entry.treatment].join('|');
      if (!unique.has(key)) unique.set(key, entry);
    });

    return [...unique.values()];
  }
}

module.exports = BaseBuylist;
