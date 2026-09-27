const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');
const { v4: uuidv4 } = require('uuid');

// Shared processor for stores hosted on Conduct Commerce (e.g. Prisma, Cerberus)
class ConductCommerceProcessor extends BaseProcessor {
  constructor({ source, host, vendorName }) {
    super();
    this.source = source;
    this.baseUrl = 'https://api.conductcommerce.com/v1/getProductListings';
    this.host = host;
    this.vendorName = vendorName;
    this.productTypeID = '1'; // MTG product type
  }

  generateSessionID() {
    return uuidv4();
  }

  generateReqID() {
    return uuidv4();
  }

  async searchCard(cardName) {
    try {
      const sessionID = this.generateSessionID();
      const reqID = this.generateReqID();

      const requestData = {
        search: cardName,
        productTypeID: this.productTypeID,
        host: this.host,
        sessionID: sessionID,
        reqID: reqID
      };

      this.logger.info(`Searching ${this.vendorName} for: ${cardName}`);
      this.logger.debug(`${this.vendorName} request data:`, requestData);

      const response = await axios.post(this.baseUrl, requestData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      this.logger.info(`${this.vendorName} response status: ${response.status} for "${cardName}"`);

      const result = this.parseResponse(response.data, cardName);

      this.logger.info(`${this.vendorName}: Found ${result.prices.length} products for "${cardName}"`);

      return {
        cardName,
        found: result.found,
        totalResults: result.prices.length,
        prices: result.prices,
        searchedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Error searching ${this.vendorName} for "${cardName}":`, error.message);
      return {
        cardName,
        found: false,
        prices: []
      };
    }
  }

  parseResponse(data, cardName) {
    try {
      this.logger.info(`Parsing ${this.vendorName} response for "${cardName}"`);

      if (!data || !data.result || !data.result.listings) {
        this.logger.info(`No listings data returned for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      const listings = data.result.listings;
      this.logger.info(`${this.vendorName}: API returned ${listings.length} raw listings for "${cardName}"`);

      if (listings.length === 0) {
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      // Filter listings to only include cards that start with the search term
      const filteredListings = listings.filter(listing => {
        const inventoryName = listing.inventoryName || '';

        // Clean both strings: remove quotes, normalize whitespace, handle encoding issues
        const cleanInventoryName = inventoryName
          .replace(/["""'']/g, '') // Remove various quote characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        const cleanSearchTerm = cardName
          .replace(/["""'']/g, '') // Remove various quote characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // Extract card name from inventory name (remove suffixes like "- Foil", "- Extended Art", etc.)
        const cardTitle = cleanInventoryName.replace(/\s*-\s*(Foil|Extended Art|Showcase|Promo|Retro Frame).*$/i, '').trim();

        const matches = cardTitle.toLowerCase().startsWith(cleanSearchTerm.toLowerCase());

        if (!matches) {
          this.logger.debug(`${this.vendorName}: Filtered out "${inventoryName}" (doesn't start with "${cardName}")`);
        }

        return matches;
      });

      this.logger.info(`${this.vendorName}: Filtered ${listings.length} results to ${filteredListings.length} matching listings for "${cardName}"`);

      const prices = [];

      // Process each listing and its variants
      for (const listing of filteredListings) {
        const setName = listing.categoryName || 'Unknown Set';
        const inventoryName = listing.inventoryName || 'Unknown Card';
        // Skip variants with no price set
        const variants = (listing.variants || []).filter(variant => parseFloat(variant.price) > 0);

        // One entry per priced variant, in stock or not
        for (const variant of variants) {
          const stock = parseInt(variant.quantity || 0);
          prices.push({
            id: `${listing.inventoryID}-${variant.id}`,
            productId: listing.inventoryID,
            name: inventoryName,
            displayName: `${inventoryName} [${setName}] - ${variant.name}`,
            price: parseFloat(variant.price),
            url: null, // Conduct Commerce doesn't provide direct URLs
            imageUrl: listing.image ? `https://${this.host}/images/${listing.image}` : null,
            stock,
            availability: stock > 0 ? 'in_stock' : 'out_of_stock',
            condition: variant.name || 'Unknown',
            vendor: this.vendorName,
            productType: 'MTG Single',
            set: setName,
            sku: null,
            variantId: variant.id
          });
        }
      }

      return {
        cardName,
        found: prices.length > 0,
        totalResults: prices.length,
        prices,
        searchedAt: new Date()
      };

    } catch (parseError) {
      this.logger.error(`Error parsing ${this.vendorName} response for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        prices: []
      };
    }
  }

  async processCards(cards) {
    const results = [];

    for (const card of cards) {
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name} with ${this.vendorName}`);

      const priceData = await this.searchCard(card.Name);

      if (priceData.found && priceData.prices.length > 0) {
        // One result per variant; the worker reduces these for display
        for (const listing of priceData.prices) {
          results.push(new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(listing.price * 100), // Convert to cents
            set: listing.set,
            condition: listing.condition || 'Unknown',
            inStock: listing.stock > 0,
            source: this.source,
            url: listing.url
          }));
        }

        this.logger.info(`${this.vendorName}: "${card.Name}" - Created ${priceData.prices.length} CardResult objects`);
      } else {
        this.logger.info(`${this.vendorName}: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, this.source));
      }

      // Add delay to be respectful to the API
      await this.delay(500);
    }

    return results;
  }

  extractSetName(productName) {
    // Try to extract set name from product title
    // Format: "Lightning Bolt [Magic 2011]"
    const bracketMatch = productName.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    return 'Unknown Set';
  }
}

module.exports = ConductCommerceProcessor;