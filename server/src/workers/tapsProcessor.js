const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../models/cardResult');

/*
Example of script tag data from Taps Games product pages:
<script>
  const product = {
    "id": 6582518546629,
    "title": "Lightning Bolt [Premium Deck Series: Fire and Lightning]",
    "handle": "lightning-bolt-premium-deck-series-fire-and-lightning",
    "description": "<p>Card Name: Lightning Bolt<br>Set: Premium Deck Series: Fire and Lightning<br>Card Type: Instant<br>Mana Cost: R<br>Converted Mana Cost: 1<br>Oracle Text: Lightning Bolt deals 3 damage to any target.<br>Power/Toughness: <br>Artist: Christopher Rush<br>Rarity: common</p>",
    "published_at": "2021-03-05T21:28:14-05:00",
    "created_at": "2021-03-05T21:28:15-05:00",
    "vendor": "Wizards of the Coast",
    "type": "",
    "tags": ["Magic the Gathering", "Singles", "red", "instant", "common", "Premium Deck Series Fire and Lightning"],
    "price": 322,
    "price_min": 322,
    "price_max": 322,
    "available": false,
    "price_varies": false,
    "compare_at_price": null,
    "compare_at_price_min": 0,
    "compare_at_price_max": 0,
    "compare_at_price_varies": false,
    "variants": [
      {
        "id": 39426916974789,
        "title": "Near Mint",
        "option1": "Near Mint",
        "option2": null,
        "option3": null,
        "sku": "",
        "requires_shipping": true,
        "taxable": true,
        "featured_image": null,
        "available": false,
        "name": "Lightning Bolt [Premium Deck Series: Fire and Lightning] - Near Mint",
        "public_title": "Near Mint",
        "options": ["Near Mint"],
        "price": 322,
        "weight": 1,
        "compare_at_price": null,
        "inventory_quantity": 0,
        "inventory_management": "shopify",
        "inventory_policy": "deny",
        "barcode": "",
        "requires_selling_plan": false,
        "selling_plan_allocations": []
      }
    ],
    "images": ["//cdn.shopify.com/s/files/1/0560/0184/5029/products/en_EX6CgJU0Qh.png?v=1614999002"],
    "featured_image": "//cdn.shopify.com/s/files/1/0560/0184/5029/products/en_EX6CgJU0Qh.png?v=1614999002",
    "options": ["Condition"],
    "media": [
      {
        "alt": null,
        "id": 20354176557253,
        "position": 1,
        "preview_image": {
          "aspect_ratio": 0.672,
          "height": 680,
          "width": 457,
          "src": "//cdn.shopify.com/s/files/1/0560/0184/5029/products/en_EX6CgJU0Qh.png?v=1614999002"
        },
        "aspect_ratio": 0.672,
        "height": 680,
        "media_type": "image",
        "src": "//cdn.shopify.com/s/files/1/0560/0184/5029/products/en_EX6CgJU0Qh.png?v=1614999002",
        "width": 457
      }
    ],
    "requires_selling_plan": false,
    "selling_plan_groups": []
  };

  const variantData = [
    {
      id: "39426916974789",
      inventory_quantity: "0",
      inventory_policy: "deny"
    }
  ];
</script>
*/

class TapsProcessor extends BaseProcessor {
  constructor() {
    super();
    this.baseUrl = 'https://store.storepass.co/saas/search';
    this.storeId = 'afbPeXJ2EK';
    this.defaultParams = {
      store_id: this.storeId,
      limit: 12,
      sort: 'Relevance',
      mongo: 'true',
      override_buylist_gt_price: 'true',
      fields: 'id,url,imageUrl,price,name,display_name'
    };
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);
      
      const params = {
        ...this.defaultParams,
        name: cardName
      };
      
      this.logger.debug(`Searching Taps for: ${cardName}`);
      
      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return this.parseResponse(response.data, cardName);
    } catch (error) {
      this.logger.error(`Error searching Taps for card "${cardName}":`, error.message);
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
      // Parse the Store Pass response format
      const products = data.products || [];
      
      if (!products.length) {
        this.logger.info(`Found 0 results for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      //"display_name": "Lightning Bolt [Anthologies]",
      //"price": 3.22,
      //"url": "https://tapsgames.com/products/lightning-bolt-anthologies",
 
      const prices = products.map(item => {
        const priceResult = {
          id: item.id,
          name: item.name,
          displayName: item.display_name,
          price: parseFloat(item.price),
          priceText: item.price_text,
          usdPrice: parseFloat(item.usd_price),
          usdPriceText: item.usd_price_text,
          retailPrice: parseFloat(item.retail_price),
          url: item.url,
          imageUrl: item.imageUrl || item.image_url,
          dataUrl: item.data_url,
          editUrl: item.edit_url,
          productType: item.productType,
          productLine: item.productLine,
          stock: item.stock,
          isHot: item.is_hot,
          store: 'Taps Games'
        };
        
        this.logger.debug(`Taps result for "${cardName}":`, priceResult);
        return priceResult;
      });

      this.logger.info(`Found ${prices.length} price results for "${cardName}" (${data.count || products.length} total results)`);

      return {
        cardName,
        found: true,
        totalResults: data.count || products.length,
        currentPage: data.current_page,
        totalPages: data.pages,
        prices,
        searchedAt: new Date()
      };
    } catch (parseError) {
      this.logger.error(`Error parsing Taps response for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        error: 'Failed to parse response',
        prices: []
      };
    }
  }

  async parseProductPage(url) {
    try {
      this.logger.debug(`Fetching product page: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return this.extractProductData(response.data);
    } catch (error) {
      this.logger.error(`Error fetching product page ${url}:`, error.message);
      return null;
    }
  }

  extractProductData(html) {
    try {
      // Extract product data from embedded JavaScript
      const productMatch = html.match(/const product = ({[\s\S]*?});/);
      const variantMatch = html.match(/const variantData = (\[[\s\S]*?\]);/);
      
      if (!productMatch) {
        return null;
      }

      const productData = JSON.parse(productMatch[1]);
      const variantData = variantMatch ? JSON.parse(variantMatch[1]) : [];

      // Extract live inventory from HTML element
      const liveInventory = this.extractLiveInventory(html);

      // Combine product and variant data
      const variants = productData.variants.map(variant => {
        const additionalVariantData = variantData.find(v => v.id === variant.id.toString());
        return {
          ...variant,
          ...additionalVariantData
        };
      });

      return {
        id: productData.id,
        title: productData.title,
        handle: productData.handle,
        description: productData.description,
        vendor: productData.vendor,
        tags: productData.tags,
        price: productData.price / 100, // Convert from cents
        priceMin: productData.price_min / 100,
        priceMax: productData.price_max / 100,
        available: productData.available,
        images: productData.images,
        featuredImage: productData.featured_image,
        liveInventory: liveInventory, // Add live inventory from HTML
        variants: variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          condition: variant.option1,
          price: variant.price / 100, // Convert from cents
          available: variant.available,
          inventoryQuantity: parseInt(variant.inventory_quantity) || 0,
          inventoryPolicy: variant.inventory_policy,
          sku: variant.sku,
          weight: variant.weight
        }))
      };
    } catch (error) {
      this.logger.error('Error extracting product data from HTML:', error.message);
      return null;
    }
  }

  extractLiveInventory(html) {
    try {
      // Extract inventory from HTML element like: <p class="product__inventory">3 in stock</p>
      const inventoryMatch = html.match(/<p[^>]*class="[^"]*product__inventory[^"]*"[^>]*>[\s\S]*?(\d+)\s+in\s+stock[\s\S]*?<\/p>/i);
      
      if (inventoryMatch) {
        return {
          quantity: parseInt(inventoryMatch[1]),
          text: `${inventoryMatch[1]} in stock`,
          inStock: parseInt(inventoryMatch[1]) > 0
        };
      }

      // Also check for "out of stock" or similar messages
      const outOfStockMatch = html.match(/<p[^>]*class="[^"]*product__inventory[^"]*"[^>]*>[\s\S]*?(out\s+of\s+stock|sold\s+out)[\s\S]*?<\/p>/i);
      
      if (outOfStockMatch) {
        return {
          quantity: 0,
          text: outOfStockMatch[1],
          inStock: false
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting live inventory:', error.message);
      return null;
    }
  }

  async processCards(cards) {
    const results = [];
    
    for (const card of cards) {
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name} with Taps`);
      
      const priceData = await this.searchCard(card.Name);
      
      if (priceData.found && priceData.prices.length > 0) {
        // Get the best price (lowest price available)
        const bestPrice = priceData.prices.reduce((min, current) => 
          current.price < min.price ? current : min
        );

        // Try to get more detailed product info if URL is available
        let detailedInfo = null;
        if (bestPrice.url) {
          detailedInfo = await this.parseProductPage(bestPrice.url);
          await this.delay(200); // Small delay for product page fetch
        }

        // Extract set info from display name (e.g., "Lightning Bolt [Anthologies]")
        const setMatch = bestPrice.displayName?.match(/\[([^\]]+)\]$/);
        const set = setMatch ? setMatch[1] : null;

        results.push(new CardResult({
          name: card.Name,
          quantity: card.Quantity,
          price: Math.round(bestPrice.price * 100), // Convert to cents
          set: set,
          condition: detailedInfo?.variants?.[0]?.condition || 'Unknown',
          inStock: (detailedInfo?.liveInventory?.inStock) || bestPrice.stock > 0,
          source: 'taps',
          url: bestPrice.url
        }));
      } else {
        results.push(this.createNotFoundResult(card, 'taps'));
      }
      
      // Add delay to be respectful to the API
      await this.delay(500);
    }
    
    return results;
  }

}

module.exports = TapsProcessor;