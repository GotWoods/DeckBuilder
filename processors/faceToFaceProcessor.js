const axios = require('axios');
const BaseProcessor = require('./baseProcessor');

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
      
      console.log(`Searching Face to Face for: ${cardName}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return this.parseResponse(response.data, cardName);
    } catch (error) {
      console.error(`Error searching for card "${cardName}":`, error.message);
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
          prices.push({
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
          });
        });
      });

      return {
        cardName,
        found: true,
        totalResults: data.hits?.total?.value || 0,
        prices,
        searchedAt: new Date()
      };
    } catch (parseError) {
      console.error(`Error parsing response for "${cardName}":`, parseError.message);
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
      console.log(`Processing ${card.Quantity}x ${card.Name}`);
      
      const priceData = await this.searchCard(card.Name);
      results.push({
        ...card,
        priceData
      });
      
      // Add delay to be respectful to the API
      await this.delay(500);
    }
    
    return results;
  }

}

module.exports = FaceToFaceProcessor;