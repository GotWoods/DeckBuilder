const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');
const { v4: uuidv4 } = require('uuid');

class PrismaProcessor extends BaseProcessor {
  constructor() {
    super();
    this.source = 'prisma';
    this.baseUrl = 'https://api.conductcommerce.com/v1/getProductListings';
    this.host = 'www.prismatcg.com';
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

      this.logger.info(`Searching Prisma for: ${cardName}`);
      this.logger.debug(`Prisma request data:`, requestData);

      const response = await axios.post(this.baseUrl, requestData, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      this.logger.info(`Prisma response status: ${response.status} for "${cardName}"`);

      const result = this.parseResponse(response.data, cardName);

      this.logger.info(`Prisma: Found ${result.prices.length} products for "${cardName}"`);

      return {
        cardName,
        found: result.found,
        totalResults: result.prices.length,
        prices: result.prices,
        searchedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Error searching Prisma for "${cardName}":`, error.message);
      return {
        cardName,
        found: false,
        prices: []
      };
    }
  }

  parseResponse(data, cardName) {
    try {
      this.logger.info(`Parsing Prisma response for "${cardName}"`);

      if (!data || !data.result || !data.result.listings) {
        this.logger.info(`No listings data returned for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      const listings = data.result.listings;
      this.logger.info(`Prisma: API returned ${listings.length} raw listings for "${cardName}"`);

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
          this.logger.debug(`Prisma: Filtered out "${inventoryName}" (doesn't start with "${cardName}")`);
        }

        return matches;
      });

      this.logger.info(`Prisma: Filtered ${listings.length} results to ${filteredListings.length} matching listings for "${cardName}"`);

      const prices = [];

      // Process each listing and its variants
      for (const listing of filteredListings) {
        const setName = listing.categoryName || 'Unknown Set';
        const inventoryName = listing.inventoryName || 'Unknown Card';
        const variants = listing.variants || [];

        // Check if any variants have quantity > 0
        const inStockVariants = variants.filter(variant => variant.quantity > 0);

        if (inStockVariants.length > 0) {
          // If there are in-stock variants, create separate entries for each
          for (const variant of inStockVariants) {
            prices.push({
              id: `${listing.inventoryID}-${variant.id}`,
              productId: listing.inventoryID,
              name: inventoryName,
              displayName: `${inventoryName} [${setName}] - ${variant.name}`,
              price: parseFloat(variant.price || 0),
              url: null, // Prisma doesn't provide direct URLs
              imageUrl: listing.image ? `https://www.prismatcg.com/images/${listing.image}` : null,
              stock: parseInt(variant.quantity || 0),
              availability: 'in_stock',
              condition: variant.name || 'Unknown',
              vendor: 'Prisma TCG',
              productType: 'MTG Single',
              set: setName,
              sku: null,
              variantId: variant.id
            });

            this.logger.debug(`Prisma: Added in-stock variant for "${inventoryName}" [${setName}] - ${variant.name}: $${variant.price}, Qty: ${variant.quantity}`);
          }
        } else {
          // If all variants have 0 quantity, create one out-of-stock entry
          const defaultVariant = variants.find(v => v.default === 1) || variants[0];
          if (defaultVariant) {
            prices.push({
              id: `${listing.inventoryID}-out-of-stock`,
              productId: listing.inventoryID,
              name: inventoryName,
              displayName: `${inventoryName} [${setName}]`,
              price: parseFloat(defaultVariant.price || 0),
              url: null,
              imageUrl: listing.image ? `https://www.prismatcg.com/images/${listing.image}` : null,
              stock: 0,
              availability: 'out_of_stock',
              condition: defaultVariant.name || 'Unknown',
              vendor: 'Prisma TCG',
              productType: 'MTG Single',
              set: setName,
              sku: null,
              variantId: defaultVariant.id
            });

            this.logger.debug(`Prisma: Added out-of-stock entry for "${inventoryName}" [${setName}]: $${defaultVariant.price}`);
          }
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
      this.logger.error(`Error parsing Prisma response for "${cardName}":`, parseError.message);
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
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name} with Prisma`);

      const priceData = await this.searchCard(card.Name);

      if (priceData.found && priceData.prices.length > 0) {
        // Group prices by set and price, then get best per group
        const pricesByGroup = {};

        for (const price of priceData.prices) {
          const setName = price.set || 'Unknown Set';

          // Create unique key combining set name and price to avoid grouping different variants
          const groupKey = `${setName}_$${price.price}`;

          // Prioritize in-stock items, then higher stock
          const currentBest = pricesByGroup[groupKey];
          const shouldReplace = !currentBest ||
            (price.stock > 0 && currentBest.stock === 0) || // Prefer in-stock over out-of-stock
            (price.stock > 0 && currentBest.stock > 0 && price.stock > currentBest.stock); // Both in-stock, prefer higher stock

          if (shouldReplace) {
            pricesByGroup[groupKey] = { ...price, set: setName };
            this.logger.debug(`Prisma: Updated best for group "${groupKey}": Stock ${price.stock}, Price $${price.price}`);
          }
        }

        this.logger.info(`Prisma: "${card.Name}" - Found ${Object.keys(pricesByGroup).length} unique groups: ${Object.keys(pricesByGroup).join(', ')}`);

        // Create a result for each group
        for (const bestPriceForGroup of Object.values(pricesByGroup)) {
          // Determine stock status
          const inStock = bestPriceForGroup.stock > 0;

          const cardResult = new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(bestPriceForGroup.price * 100), // Convert to cents
            set: bestPriceForGroup.set,
            condition: bestPriceForGroup.condition || 'Unknown',
            inStock: inStock,
            source: this.source,
            url: bestPriceForGroup.url
          });

          this.logger.debug(`Prisma: Creating result for "${card.Name}" from set "${bestPriceForGroup.set}" - $${bestPriceForGroup.price}`);
          results.push(cardResult);
        }

        this.logger.info(`Prisma: "${card.Name}" - Created ${Object.keys(pricesByGroup).length} CardResult objects`);
      } else {
        this.logger.info(`Prisma: "${card.Name}" - No prices found, creating not-found result`);
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

module.exports = PrismaProcessor;