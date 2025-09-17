const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

class FaceToFaceProcessor extends BaseProcessor {
  constructor() {
    super();
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
      const url = `${this.baseUrl}/Game%20Type/Magic:%20The%20Gathering/withFacets/false/pageSize/6/page/1/minimum_price/0.01/keyword/${encodedCardName}`;
      
      this.logger.debug(`Searching Face to Face for: ${cardName}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return this.parseResponse(response.data, cardName);
    } catch (error) {
      this.logger.error(`Error searching for card "${cardName}":`, error.message);
      return {
        cardName,
        found: false,
        error: error.message,
        prices: []
      };
    }
  }

  parseResponse(data, cardName) {
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
          const priceResult = {
            name: source.title,
            price: parseFloat(variant.price),
            sellPrice: parseFloat(variant.sellPrice),
            condition: variant.selectedOptions?.find(opt => opt.name === 'Condition')?.value || 'Unknown',
            set: source.Set || source.MTG_Set_Name,
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
      const setInfo = prices.map(p => ({ set: p.set, price: p.sellPrice, inStock: p.inStock }));
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
        // Group prices by set, then get best price per set
        const pricesBySet = {};
        priceData.prices.forEach(price => {
          const setName = price.set || 'Unknown Set';
          if (!pricesBySet[setName] || price.sellPrice < pricesBySet[setName].sellPrice) {
            pricesBySet[setName] = price;
          }
        });

        this.logger.info(`FaceToFace: "${card.Name}" - Found ${Object.keys(pricesBySet).length} unique sets: ${Object.keys(pricesBySet).join(', ')}`);

        // Create a result for each set
        Object.values(pricesBySet).forEach(bestPriceForSet => {
          const productUrl = bestPriceForSet.productHandle
            ? `https://facetofacegames.com/products/${bestPriceForSet.productHandle}`
            : null;

          const cardResult = new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(bestPriceForSet.sellPrice * 100), // Convert to cents
            set: bestPriceForSet.set,
            condition: bestPriceForSet.condition,
            inStock: bestPriceForSet.inStock,
            source: 'facetoface',
            url: productUrl
          });

          this.logger.debug(`FaceToFace: Creating result for "${card.Name}" from set "${bestPriceForSet.set}" - $${bestPriceForSet.sellPrice}`);
          results.push(cardResult);
        });

        this.logger.info(`FaceToFace: "${card.Name}" - Created ${Object.keys(pricesBySet).length} CardResult objects`);
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