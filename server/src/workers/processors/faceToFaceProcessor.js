const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

class FaceToFaceProcessor extends BaseProcessor {
  constructor() {
    super();
    this.source = 'facetoface';
    this.baseUrl = 'https://facetofacegames.com/apps/prod-indexer/search';
    this.defaultParams = {
      'Game Type': 'Magic: The Gathering',
      withFacets: 'false',
      pageSize: '6',
      page: '1',
      minimum_price: '0.01'
    };
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);

      let allProducts = [];
      let currentPage = 1;
      let hasMorePages = true;
      const pageSize = 50; // Use 50 for good coverage per page

      this.logger.info(`Searching Face2Face for: ${cardName} (with pagination)`);

      while (hasMorePages) {
        const url = `${this.baseUrl}/Game%20Type/Magic:%20The%20Gathering/withFacets/false/pageSize/${pageSize}/page/${currentPage}/minimum_price/0.01/keyword/${encodedCardName}`;

        this.logger.debug(`Face2Face: Fetching page ${currentPage} for "${cardName}"`);
        this.logger.info(`Face2Face URL: ${url}`);

        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        this.logger.info(`Face2Face response status: ${response.status} for "${cardName}" page ${currentPage}`);

        const pageResult = this.parseResponse(response.data, cardName, currentPage);

        if (pageResult.found && pageResult.prices.length > 0) {
          allProducts = allProducts.concat(pageResult.prices);

          // Check if we have more pages using Elasticsearch total results
          const totalHits = response.data.hits?.total?.value || 0;

          const totalPages = Math.ceil(totalHits / pageSize);

          if (currentPage < totalPages) {
            this.logger.info(`Face2Face: Page ${currentPage} returned ${pageResult.prices.length} results, continuing to page ${currentPage + 1} (${totalPages} total pages) for "${cardName}"`);
            currentPage++;
          } else {
            hasMorePages = false;
            this.logger.info(`Face2Face: Page ${currentPage} was the last page for "${cardName}"`);
          }
        } else {
          hasMorePages = false;
          this.logger.info(`Face2Face: Page ${currentPage} returned no results, stopping pagination for "${cardName}"`);
        }

        // Add delay between requests to be respectful
        if (hasMorePages) {
          await this.delay(300);
        }
      }

      this.logger.info(`Face2Face: Found total of ${allProducts.length} products across ${currentPage} pages for "${cardName}"`);

      return {
        cardName,
        found: allProducts.length > 0,
        totalResults: allProducts.length,
        totalPages: currentPage,
        prices: allProducts,
        searchedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Error searching Face2Face for "${cardName}":`, error.message);
      return {
        cardName,
        found: false,
        error: error.message,
        prices: []
      };
    }
  }

  parseResponse(data, cardName, pageNumber = 1) {
    try {
      // Parse the Elasticsearch response format from Face to Face
      const hits = data.hits?.hits || [];
      
      if (!hits.length) {
        this.logger.info(`Found 0 results for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      const prices = [];
      
      hits.forEach(hit => {
        const source = hit._source;
        const variants = source.variants || [];
        
        variants.forEach(variant => {
          // variant.price is the retail price; variant.sellPrice is F2F's buylist price (what they pay you)
          const retailPrice = parseFloat(variant.price) || 0;

          // Skip variants with invalid prices (0 or NaN)
          if (retailPrice <= 0) {
            this.logger.debug(`Face2Face: Skipping variant with invalid price for "${cardName}": price=${variant.price}`);
            return; // Skip this variant
          }

          const priceResult = {
            name: source.title,
            price: retailPrice,
            buylistPrice: parseFloat(variant.sellPrice) || 0,
            condition: variant.selectedOptions?.find(opt => opt.name === 'Condition')?.value || 'Unknown',
            set: this.ensureString(source.Set || source.MTG_Set_Name),
            collectorNumber: source.MTG_Collector_Number,
            rarity: source.MTG_Rarity,
            foil: source.MTG_Foil_Option === 'Foil',
            language: source.General_Card_Language,
            inStock: variant.inventoryQuantity > 0,
            inventoryQuantity: variant.inventoryQuantity,
            sku: variant.sku,
            imageUrl: variant.image?.url,
            productHandle: source.handle
          };

          this.logger.debug(`Face to Face result for "${cardName}":`, priceResult);
          prices.push(priceResult);
        });
      });

      this.logger.info(`Found ${prices.length} price results for "${cardName}" (${data.hits?.total?.value || 0} total hits)`);

      // Debug logging for set information
      const setInfo = prices.map(p => ({ set: p.set, price: p.price, inStock: p.inStock }));
      this.logger.debug(`FaceToFace sets found for "${cardName}":`, JSON.stringify(setInfo, null, 2));

      return {
        cardName,
        found: true,
        totalResults: data.hits?.total?.value || 0,
        prices,
        searchedAt: new Date()
      };
    } catch (parseError) {
      this.logger.error(`Error parsing response for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        error: 'Failed to parse response',
        prices: []
      };
    }
  }

  async processCards(cards) {
    const results = [];
    
    for (const card of cards) {
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name}`);
      
      const priceData = await this.searchCard(card.Name);
      
      if (priceData.found && priceData.prices.length > 0) {
        // One result per variant; the worker reduces these for display
        priceData.prices.forEach(listing => {
          const productUrl = listing.productHandle
            ? `https://facetofacegames.com/products/${listing.productHandle}`
            : null;

          results.push(new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(listing.price * 100), // Convert to cents
            set: listing.set,
            condition: listing.condition,
            inStock: listing.inStock,
            source: 'facetoface',
            url: productUrl
          }));
        });

        this.logger.info(`FaceToFace: "${card.Name}" - Created ${priceData.prices.length} CardResult objects`);
      } else {
        this.logger.info(`FaceToFace: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, 'facetoface'));
      }
      
      // Add delay to be respectful to the API
      await this.delay(500);
    }
    
    return results;
  }

}

module.exports = FaceToFaceProcessor;