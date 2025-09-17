const axios = require('axios');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

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
    this.source = 'taps';
    this.baseUrl = 'https://store.storepass.co/saas/search';
    this.storeId = 'afbPeXJ2EK';
    this.defaultParams = {
      store_id: this.storeId,
      limit: 200, // Increased to get more results per page
      sort: 'Relevance',
      mongo: 'true',
      override_buylist_gt_price: 'true',
      product_line: 'All',
      fields: 'id,productId,availability,stock,selectedFinish,url,imageUrl,price,salePrice,regularPrice,name,variantInfo,bigCommerceImages,msrp,tags,publisher,inventoryLevels,customCollectionImages,display_name',
      convert_to_currency: '',
      round_price: '',
      big_commerce_category_ids: '',
      brand_name: '',
      shopify_collection_id: '',
      product_ids: '',
      product_handles: '',
      set_name: '',
      rarity: '',
      import_list_text: '',
      is_hot: '',
      players: '',
      playtime: '',
      min_year: '',
      max_year: '',
      min_price: '',
      max_price: '',
      product_type: '',
      publisher: '',
      designer: '',
      mechanic: '',
      category: '',
      type_line: '',
      color: '',
      finish: '',
      vendor: '',
      tags: '',
      exclude_tag: '',
      in_stock: ''
    };
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);

      let allProducts = [];
      let currentPage = 1;
      let hasMorePages = true;

      this.logger.info(`Searching Taps for: ${cardName} (with pagination)`);

      while (hasMorePages) {
        const params = {
          ...this.defaultParams,
          name: cardName,
          q: cardName,
          page: currentPage
        };

        this.logger.debug(`Taps: Fetching page ${currentPage} for "${cardName}"`);

        const response = await axios.get(this.baseUrl, {
          params,
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const rawProducts = response.data.products || [];
        this.logger.info(`Taps: Page ${currentPage} API returned ${rawProducts.length} raw products for "${cardName}"`);

        if (rawProducts.length > 0) {
          const pageResult = this.parseResponse(response.data, cardName, currentPage);
          allProducts = allProducts.concat(pageResult.prices);

          // Check if we have more pages based on RAW API response count, not filtered count
          if (rawProducts.length < this.defaultParams.limit) {
            hasMorePages = false;
            this.logger.info(`Taps: Page ${currentPage} returned ${rawProducts.length} raw results (< ${this.defaultParams.limit}), stopping pagination for "${cardName}"`);
          } else {
            this.logger.info(`Taps: Page ${currentPage} returned ${rawProducts.length} raw results, checking next page for "${cardName}"`);
            currentPage++;
          }
        } else {
          hasMorePages = false;
          this.logger.info(`Taps: Page ${currentPage} returned no results, stopping pagination for "${cardName}"`);
        }

        // Add a small delay between requests to be respectful
        if (hasMorePages) {
          await this.delay(200);
        }
      }

      this.logger.info(`Taps: Found total of ${allProducts.length} products across ${currentPage} pages for "${cardName}"`);

      return {
        cardName,
        found: allProducts.length > 0,
        totalResults: allProducts.length,
        totalPages: currentPage,
        prices: allProducts,
        searchedAt: new Date()
      };

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

  parseResponse(data, cardName, pageNumber = 1) {
    try {
      // Parse the Store Pass response format
      const products = data.products || [];

      this.logger.info(`Taps: Page ${pageNumber} API returned ${products.length} raw products for "${cardName}"`);

      if (!products.length) {
        this.logger.info(`Found 0 results on page ${pageNumber} for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      //"display_name": "Lightning Bolt [Anthologies]",
      //"price": 3.22,
      //"url": "https://tapsgames.com/products/lightning-bolt-anthologies",

      // Filter products with robust character handling
      const filteredProducts = products.filter(item => {
        const productName = item.display_name || item.name || '';

        // Clean both strings: remove quotes, normalize whitespace, handle encoding issues
        const cleanProductName = productName
          .replace(/["""'']/g, '') // Remove various quote characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        const cleanSearchTerm = cardName
          .replace(/["""'']/g, '') // Remove various quote characters
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // Extract card name from display name (e.g., "Lightning Bolt [Anthologies]" -> "Lightning Bolt")
        const cardTitle = cleanProductName.replace(/\s*\[.*?\]\s*$/, '').trim();

        const matches = cardTitle.toLowerCase().startsWith(cleanSearchTerm.toLowerCase());

        if (!matches && productName.toLowerCase().includes('sol ring')) {
          // Debug only Sol Ring mismatches to see the issue
          this.logger.info(`Taps: DEBUG - productName: "${productName}" -> cardTitle: "${cardTitle}" vs searchTerm: "${cleanSearchTerm}"`);
        }

        return matches;
      });

      this.logger.info(`Taps: Filtered ${products.length} results to ${filteredProducts.length} matching products for "${cardName}"`);

      if (filteredProducts.length === 0) {
        this.logger.warn(`Taps: WARNING - All products filtered out for "${cardName}". Raw product sample: ${products.slice(0, 3).map(p => p.display_name || p.name).join(', ')}`);
      }

      const prices = filteredProducts.map(item => {
        const priceResult = {
          id: item.id,
          productId: item.productId,
          name: item.name,
          displayName: item.display_name,
          price: parseFloat(item.price),
          salePrice: parseFloat(item.salePrice),
          regularPrice: parseFloat(item.regularPrice),
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
          availability: item.availability,
          inventoryLevels: item.inventoryLevels,
          variantInfo: item.variantInfo,
          selectedFinish: item.selectedFinish,
          tags: item.tags,
          publisher: item.publisher,
          msrp: item.msrp,
          isHot: item.is_hot,
          store: 'Taps Games'
        };

        // Debug enhanced stock information
        this.logger.info(`Taps: "${item.display_name}" - Stock: ${item.stock}, Availability: ${item.availability}, InventoryLevels: ${JSON.stringify(item.inventoryLevels)}, Price: $${item.price}`);
        
        this.logger.debug(`Taps result for "${cardName}":`, priceResult);
        return priceResult;
      });

      this.logger.info(`Found ${prices.length} price results for "${cardName}" (${filteredProducts.length} filtered from ${products.length} total results)`);

      // Debug logging for set information
      const setInfo = prices.map(p => {
        const setMatch = p.displayName?.match(/\[([^\]]+)\]$/);
        const set = setMatch ? setMatch[1] : 'No Set Found';
        return { displayName: p.displayName, extractedSet: set, price: p.price };
      });
      this.logger.debug(`Taps sets found for "${cardName}":`, JSON.stringify(setInfo, null, 2));

      return {
        cardName,
        found: true,
        totalResults: filteredProducts.length,
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
      if (!productMatch) {
        this.logger.error('No product data found in script tags');
        return null;
      }

      const productData = JSON.parse(productMatch[1]);

      // Extract productVariants data which contains actual inventory
      const variantMatch = html.match(/const productVariants = (\[[\s\S]*?\]);/);
      let productVariants = [];
      if (variantMatch) {
        productVariants = JSON.parse(variantMatch[1]);
        this.logger.debug('Found productVariants data:', productVariants);
      } else {
        this.logger.debug('No productVariants found, checking for variantData');
        // Fallback to old variantData format
        const oldVariantMatch = html.match(/const variantData = (\[[\s\S]*?\]);/);
        if (oldVariantMatch) {
          productVariants = JSON.parse(oldVariantMatch[1]);
        }
      }

      // Extract live inventory from HTML element as backup
      const liveInventory = this.extractLiveInventory(html);

      // Combine product and variant data
      const variants = productData.variants.map(variant => {
        // Find matching variant in productVariants data
        const variantInventory = productVariants.find(v =>
          v.id === variant.id.toString() || v.id === variant.id
        );

        let inventoryQuantity = 0;
        let available = variant.available;

        if (variantInventory) {
          // Use inventory from productVariants if available
          inventoryQuantity = parseInt(variantInventory.inventory_quantity) || 0;
          available = inventoryQuantity > 0;
          this.logger.debug(`Variant ${variant.id}: Found inventory ${inventoryQuantity}`);
        } else {
          // Fallback to original variant data
          inventoryQuantity = parseInt(variant.inventory_quantity) || 0;
          this.logger.debug(`Variant ${variant.id}: Using original inventory ${inventoryQuantity}`);
        }

        return {
          ...variant,
          inventoryQuantity: inventoryQuantity,
          available: available
        };
      });

      const result = {
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
        liveInventory: liveInventory,
        variants: variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          condition: variant.option1,
          price: variant.price / 100, // Convert from cents
          available: variant.available,
          inventoryQuantity: variant.inventoryQuantity,
          inventoryPolicy: variant.inventory_policy,
          sku: variant.sku,
          weight: variant.weight
        }))
      };

      this.logger.debug(`Extracted product data for ${productData.title}:`, {
        totalVariants: result.variants.length,
        variantsWithStock: result.variants.filter(v => v.inventoryQuantity > 0).length
      });

      return result;
    } catch (error) {
      this.logger.error('Error extracting product data from HTML:', error.message);
      this.logger.error('Error details:', error.stack);
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
        // Group prices by set, then get best price per set
        const pricesBySet = {};

        for (const price of priceData.prices) {
          // Extract set info from display name (e.g., "Lightning Bolt [Anthologies]" or "Sol Ring [Set] Extra Text")
          const setMatch = price.displayName?.match(/\[([^\]]+)\]/);
          const setName = setMatch ? setMatch[1] : 'Unknown Set';

          // Create unique key combining set name and price to avoid grouping different variants
          const groupKey = `${setName}_$${price.price}`;

          // Debug in-stock items specifically
          if (price.stock > 0) {
            this.logger.info(`Taps: "${card.Name}" - IN-STOCK ITEM: "${price.displayName}" -> Set: "${setName}", Stock: ${price.stock}, Price: $${price.price}, GroupKey: "${groupKey}"`);
          }

          this.logger.debug(`Taps: "${card.Name}" - Display name: "${price.displayName}" -> Extracted set: "${setName}"`);

          // Prioritize in-stock items, then lowest price (but only group identical prices)
          const currentBest = pricesBySet[groupKey];
          const shouldReplace = !currentBest ||
            (price.stock > 0 && currentBest.stock === 0) || // Prefer in-stock over out-of-stock
            (price.stock > 0 && currentBest.stock > 0 && price.stock > currentBest.stock); // Both in-stock, prefer higher stock

          if (shouldReplace) {
            pricesBySet[groupKey] = { ...price, set: setName };
            this.logger.info(`Taps: "${card.Name}" - Updated best for group "${groupKey}": Stock ${price.stock}, Price $${price.price}`);
          }
        }

        this.logger.info(`Taps: "${card.Name}" - Found ${Object.keys(pricesBySet).length} unique sets: ${Object.keys(pricesBySet).join(', ')}`);

        // Create a result for each set
        for (const bestPriceForSet of Object.values(pricesBySet)) {
          // Determine stock status using enhanced API data
          let inStock = false;
          let condition = 'Unknown';

          // Use the stock field from API as primary source
          if (bestPriceForSet.stock !== null && bestPriceForSet.stock !== undefined) {
            // Primary: Use stock field from API
            inStock = bestPriceForSet.stock > 0;
            this.logger.info(`Taps: "${card.Name}" - Using API stock field: ${bestPriceForSet.stock}, InStock: ${inStock}`);
          } else if (bestPriceForSet.inventoryLevels && Array.isArray(bestPriceForSet.inventoryLevels)) {
            // Fallback: Use inventoryLevels if available
            const totalInventory = bestPriceForSet.inventoryLevels.reduce((total, level) => total + (level.quantity || 0), 0);
            inStock = totalInventory > 0;
            this.logger.info(`Taps: "${card.Name}" - Using inventoryLevels: ${totalInventory}, InStock: ${inStock}`);
          } else if (bestPriceForSet.variantInfo && Array.isArray(bestPriceForSet.variantInfo)) {
            // Fallback: Use variantInfo if available
            const variantsWithStock = bestPriceForSet.variantInfo.filter(v => v.inventory_quantity > 0);
            inStock = variantsWithStock.length > 0;
            const totalVariantStock = bestPriceForSet.variantInfo.reduce((total, variant) => total + (variant.inventory_quantity || 0), 0);
            this.logger.info(`Taps: "${card.Name}" - Using variantInfo: ${totalVariantStock}, InStock: ${inStock}`);
          } else if (bestPriceForSet.availability) {
            // Final fallback: Check availability field
            inStock = bestPriceForSet.availability === 'in_stock' || bestPriceForSet.availability === true;
            this.logger.info(`Taps: "${card.Name}" - Using availability: ${bestPriceForSet.availability}, InStock: ${inStock}`);
          } else {
            this.logger.info(`Taps: "${card.Name}" - No inventory data available, assuming out of stock`);
          }

          // Extract condition from variantInfo if available
          if (bestPriceForSet.variantInfo && bestPriceForSet.variantInfo.length > 0) {
            const firstVariant = bestPriceForSet.variantInfo[0];
            condition = firstVariant.condition || firstVariant.title || 'Unknown';
          }

          const cardResult = new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(bestPriceForSet.price * 100), // Convert to cents
            set: bestPriceForSet.set,
            condition: condition,
            inStock: inStock,
            source: 'taps',
            url: bestPriceForSet.url
          });

          this.logger.debug(`Taps: Creating result for "${card.Name}" from set "${bestPriceForSet.set}" - $${bestPriceForSet.price}`);
          results.push(cardResult);
        }

        this.logger.info(`Taps: "${card.Name}" - Created ${Object.keys(pricesBySet).length} CardResult objects`);
      } else {
        this.logger.info(`Taps: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, 'taps'));
      }
      
      // Add delay to be respectful to the API
      await this.delay(500);
    }
    
    return results;
  }

}

module.exports = TapsProcessor;