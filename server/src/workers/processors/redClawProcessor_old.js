const axios = require('axios');
const cheerio = require('cheerio');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

class RedClawProcessor extends BaseProcessor {
  constructor() {
    super();
    this.baseUrl = 'https://www.redclawgaming.com/search';
    this.source = 'redclaw';
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);
      const url = `${this.baseUrl}?q=${encodedCardName}*+product_type%3A%22mtg%22`;

      this.logger.info(`Searching RedClaw for: ${cardName}`);
      this.logger.info(`RedClaw URL: ${url}`);

      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      this.logger.info(`RedClaw response status: ${response.status} for "${cardName}"`);

      return this.parseResponse(response.data, cardName);
    } catch (error) {
      this.logger.error(`Error searching RedClaw for card "${cardName}":`, error.message);
      this.logger.error(`Error details:`, error.response?.status, error.response?.statusText);
      return {
        cardName,
        found: false,
        error: error.message,
        prices: []
      };
    }
  }

  parseResponse(html, cardName) {
    try {
      // RedClaw returns HTML with embedded search results in script tags
      // Look for the web-pixels-manager-setup script that contains search data

      this.logger.info(`RedClaw response length for "${cardName}": ${html.length} characters`);

      // Try multiple patterns to find the search data

      // Pattern 1: Look for productVariants array in analytics data (most reliable)
      let scriptMatch = html.match(/"productVariants":\s*(\[[\s\S]*?\](?=\s*[,}]))/);
      if (!scriptMatch) {
        // Pattern 2: Look for events array in web-pixels-manager script
        scriptMatch = html.match(/"events":\s*(\[.*?\])/s);
      }
      if (!scriptMatch) {
        // Pattern 3: Look for search events more broadly
        scriptMatch = html.match(/search_submitted[^}]*searchResult[^}]*productVariants:\s*(\[.*?\])/s);
      }

      // Always try HTML parsing first as it's more reliable for RedClaw
      this.logger.info(`Attempting HTML parsing for "${cardName}"`);
      const htmlResult = this.parseHtmlResponse(html, cardName);

      if (htmlResult.found && htmlResult.prices && htmlResult.prices.length > 0) {
        this.logger.info(`HTML parsing successful for "${cardName}" - found ${htmlResult.prices.length} products`);
        return htmlResult;
      }

      this.logger.info(`HTML parsing found no products for "${cardName}", trying JSON fallback`);

      // Fallback to JSON parsing if HTML parsing fails
      if (scriptMatch) {
        this.logger.info(`HTML parsing failed, trying JSON patterns for "${cardName}"`);
        try {
          let jsonResult = null;

          // Check which pattern matched and parse accordingly
          if (scriptMatch[0].includes('"productVariants"')) {
            // Direct productVariants array found
            const productVariants = JSON.parse(scriptMatch[1]);
            this.logger.info(`Found ${productVariants.length} product variants for "${cardName}"`);

            const mockSearchResult = { productVariants };
            jsonResult = this.parseSearchEventData(mockSearchResult, cardName);
          } else if (scriptMatch[0].includes('"events"')) {
            // Events array found
            const events = JSON.parse(scriptMatch[1]);
            this.logger.info(`Parsed ${events.length} events for "${cardName}"`);

            const searchEvent = events.find(event => event[0] === 'search_submitted');
            if (searchEvent && searchEvent[1] && searchEvent[1].searchResult) {
              this.logger.info(`Found search_submitted event for "${cardName}"`);
              jsonResult = this.parseSearchEventData(searchEvent[1].searchResult, cardName);
            }
          } else {
            // Fallback for other patterns - assume productVariants
            const productVariants = JSON.parse(scriptMatch[1]);
            this.logger.info(`Found ${productVariants.length} product variants for "${cardName}" (fallback)"`);

            const mockSearchResult = { productVariants };
            jsonResult = this.parseSearchEventData(mockSearchResult, cardName);
          }

          // If JSON parsing found results, return them
          if (jsonResult && jsonResult.found && jsonResult.prices && jsonResult.prices.length > 0) {
            this.logger.info(`JSON parsing successful for "${cardName}" - found ${jsonResult.prices.length} products`);
            return jsonResult;
          } else {
            this.logger.info(`JSON parsing found no products for "${cardName}", returning HTML result`);
          }

        } catch (parseError) {
          this.logger.info(`Failed to parse JSON data: ${parseError.message}`);
        }
      }

      // Final fallback: look for other JSON patterns
      const jsonMatch = html.match(/window\.search_results\s*=\s*({.*?});/);
      if (jsonMatch) {
        try {
          const searchData = JSON.parse(jsonMatch[1]);
          return this.parseSearchData(searchData, cardName);
        } catch (parseError) {
          this.logger.debug('Failed to parse fallback JSON data');
        }
      }

      this.logger.info(`All parsing methods failed for "${cardName}"`);
      return htmlResult; // Return the HTML result even if empty
    } catch (parseError) {
      this.logger.error(`Error parsing RedClaw response for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        error: 'Failed to parse response',
        prices: []
      };
    }
  }

  parseSearchEventData(searchResult, cardName) {
    // Parse the search event data from the web pixels manager
    const productVariants = searchResult.productVariants || [];

    if (!productVariants.length) {
      this.logger.info(`Found 0 results for "${cardName}"`);
      return {
        cardName,
        found: false,
        prices: []
      };
    }

    const prices = productVariants.map(variant => {
      const product = variant.product;
      const price = variant.price;

      return {
        id: variant.id,
        productId: product.id,
        name: product.title,
        price: parseFloat(price.amount) || 0,
        currencyCode: price.currencyCode,
        url: product.url ? `https://www.redclawgaming.com${product.url}` : null,
        imageUrl: variant.image ? `https:${variant.image.src}` : null,
        available: true, // Assume available if in search results
        sku: variant.sku,
        condition: variant.title, // Usually contains condition like "Near Mint"
        vendor: product.vendor,
        productType: product.type,
        variantTitle: variant.title
      };
    });

    this.logger.info(`Found ${prices.length} price results for "${cardName}" from search event data`);

    // Debug logging for set information
    const setInfo = prices.map(p => ({ name: p.name, price: p.price, condition: p.condition }));
    this.logger.debug(`RedClaw sets found for "${cardName}":`, JSON.stringify(setInfo, null, 2));

    return {
      cardName,
      found: true,
      totalResults: productVariants.length,
      prices,
      searchedAt: new Date()
    };
  }

  parseSearchData(data, cardName) {
    // Parse JSON search results if available (fallback method)
    const products = data.products || data.results || [];

    if (!products.length) {
      this.logger.info(`Found 0 results for "${cardName}"`);
      return {
        cardName,
        found: false,
        prices: []
      };
    }

    const prices = products.map(product => {
      return {
        id: product.id,
        name: product.title || product.name,
        price: parseFloat(product.price) || 0,
        url: product.url ? `https://www.redclawgaming.com${product.url}` : null,
        imageUrl: product.image,
        available: product.available !== false,
        variants: product.variants || [],
        vendor: product.vendor,
        productType: product.product_type,
        tags: product.tags || []
      };
    });

    this.logger.info(`Found ${prices.length} price results for "${cardName}"`);

    return {
      cardName,
      found: true,
      totalResults: products.length,
      prices,
      searchedAt: new Date()
    };
  }

  parseHtmlResponse(html, cardName) {
    // Parse HTML using Cheerio for more reliable parsing
    try {
      this.logger.info(`Starting HTML parsing for "${cardName}"`);

      const $ = cheerio.load(html);
      const productElements = $('.product.Norm');

      this.logger.info(`HTML contains ${productElements.length} product divs for "${cardName}"`);

      if (productElements.length === 0) {
        this.logger.info(`RedClaw: No product divs found for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      const products = [];
      let productCount = 0;

      productElements.each((index, element) => {
        productCount++;
        const $product = $(element);

        this.logger.info(`RedClaw: Processing product #${productCount} for "${cardName}"`);

        // Check for addToCart onclick (in-stock products)
        const $addToCart = $product.find('[onclick*="addToCart"]');
        if ($addToCart.length > 0) {
          const onclickValue = $addToCart.attr('onclick');
          const onclickMatch = onclickValue.match(/addToCart\('([^']+)','([^']+)','([^']+)',([^)]+)\)/);

          if (onclickMatch) {
            const productId = onclickMatch[1];
            const fullTitle = onclickMatch[2];
            const quantity = onclickMatch[3];
            let priceValue = parseFloat(onclickMatch[4]) || 0;

            // Extract actual price from p tag if available
            const $priceTag = $addToCart.find('p');
            if ($priceTag.length > 0) {
              const priceText = $priceTag.text();
              const priceMatch = priceText.match(/\$([0-9.]+)/);
              if (priceMatch) {
                const actualPrice = parseFloat(priceMatch[1]);
                if (actualPrice && actualPrice !== priceValue) {
                  this.logger.info(`RedClaw: Using actual price $${actualPrice} instead of onclick price $${priceValue} for "${cardName}"`);
                  priceValue = actualPrice;
                }
              }
            }

            // Parse card name and set from title
            const bracketMatch = fullTitle.match(/^(.*?)\s*\[([^\]]+)\]\s*(.*)$/);
            if (bracketMatch) {
              const cardTitle = bracketMatch[1].trim();
              const setName = bracketMatch[2].trim();
              const condition = bracketMatch[3].replace(/^-\s*/, '').trim();

              this.logger.info(`RedClaw: Found in-stock product: "${cardTitle}" from set "${setName}" at $${priceValue}`);

              products.push({
                id: `redclaw-${productId}`,
                productId: productId,
                name: cardTitle,
                price: priceValue,
                currencyCode: 'CAD',
                url: null,
                imageUrl: null,
                available: true,
                sku: null,
                condition: condition,
                vendor: 'RedClaw Gaming',
                productType: 'MTG Single',
                variantTitle: fullTitle,
                set: setName
              });
            }
          }
        } else {
          // Check for sold-out products using productTitle
          const $productTitle = $product.find('p.productTitle');
          if ($productTitle.length > 0) {
            const titleHtml = $productTitle.html();
            if (titleHtml && titleHtml.includes('<br>')) {
              const [cardName, setWithBrackets] = titleHtml.split('<br>');
              const cardTitle = cardName.trim();
              const setName = setWithBrackets.replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();

              // Try to extract original price if available
              let originalPrice = 0;
              const $priceElement = $product.find('.productPrice, p:contains("$")');
              if ($priceElement.length > 0) {
                const priceText = $priceElement.text();
                const priceMatch = priceText.match(/\$([0-9.]+)/);
                if (priceMatch) {
                  originalPrice = parseFloat(priceMatch[1]);
                }
              }

              this.logger.info(`RedClaw: Found sold-out product: "${cardTitle}" from set "${setName}"`);

              products.push({
                id: `redclaw-soldout-${productCount}`,
                productId: `soldout-${productCount}`,
                name: cardTitle,
                price: originalPrice,
                currencyCode: 'CAD',
                url: null,
                imageUrl: null,
                available: false,
                sku: null,
                condition: 'Unknown',
                vendor: 'RedClaw Gaming',
                productType: 'MTG Single',
                variantTitle: `${cardTitle} [${setName}]`,
                set: setName
              });
            }
          } else {
            this.logger.info(`RedClaw: Product #${productCount} - No onclick or productTitle found for "${cardName}"`);
          }
        }
      });

      this.logger.info(`Extracted ${products.length} products from HTML for "${cardName}"`);

      return {
        cardName,
        found: products.length > 0,
        totalResults: products.length,
        prices: products,
        searchedAt: new Date()
      };

    } catch (parseError) {
      this.logger.error(`Error parsing HTML for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        prices: []
      };
    }
  }

        // The addToCart price parameter is often just 1, so extract actual price from <p> tag
        const priceTagMatch = productHtml.match(/<p[^>]*>.*?\$([0-9.]+)<\/p>/);
        if (priceTagMatch) {
          const actualPrice = parseFloat(priceTagMatch[1]);
          if (actualPrice && actualPrice !== priceValue) {
            this.logger.info(`RedClaw: Using actual price from p tag $${actualPrice} instead of onclick price $${priceValue} for "${cardName}"`);
            priceValue = actualPrice;
          }
        }

        this.logger.info(`RedClaw: Found product for "${cardName}": "${fullTitle}" at $${priceValue}`);

        // Extract card name and set from full title
        // Parse: everything before [ = card name, everything between [] = set name, everything after ] = condition
        const bracketMatch = fullTitle.match(/^(.*?)\s*\[([^\]]+)\]\s*(.*)$/);
        if (!bracketMatch) {
          this.logger.info(`RedClaw: Product #${productCount} - Could not parse title format for "${cardName}": "${fullTitle}"`);
          continue;
        }

        const cardTitle = bracketMatch[1].trim();
        const setName = bracketMatch[2].trim();
        const condition = bracketMatch[3].replace(/^-\s*/, '').trim(); // Remove leading dash from condition

        this.logger.info(`RedClaw: Parsed for "${cardName}": Card="${cardTitle}", Set="${setName}", Condition="${condition}", Price=$${priceValue}`);

        this.logger.info(`RedClaw: Successfully extracted price for "${cardName}": $${priceValue} (${condition})`);

        products.push({
          id: `redclaw-${productId}`,
          productId: productId,
          name: cardTitle,
          price: priceValue,
          currencyCode: 'CAD',
          url: null, // Could extract from href if needed
          imageUrl: null, // Could extract from img src if needed
          available: true, // Assume available if price is shown
          sku: null,
          condition: condition,
          vendor: 'RedClaw Gaming',
          productType: 'MTG Single',
          variantTitle: fullTitle,
          set: setName // Include set information
        });
      }

      if (products.length === 0) {
        this.logger.info(`No products found in HTML for "${cardName}"`);
        return {
          cardName,
          found: false,
          prices: []
        };
      }

      this.logger.info(`Extracted ${products.length} products from HTML for "${cardName}"`);

      // Log all sets found to identify duplicates
      const allSets = products.map(p => p.set);
      this.logger.info(`RedClaw: All sets found for "${cardName}": ${allSets.join(', ')}`);

      // Check for duplicates
      const uniqueSets = [...new Set(allSets)];
      if (allSets.length !== uniqueSets.length) {
        this.logger.info(`RedClaw: Found ${allSets.length - uniqueSets.length} duplicate sets for "${cardName}"`);
      }

      return {
        cardName,
        found: true,
        totalResults: products.length,
        prices: products,
        searchedAt: new Date()
      };

    } catch (parseError) {
      this.logger.error(`Error parsing HTML for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        error: 'Failed to parse HTML response',
        prices: []
      };
    }
  }

  async processCards(cards) {
    const results = [];

    for (const card of cards) {
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name} with RedClaw`);

      const priceData = await this.searchCard(card.Name);

      if (priceData.found && priceData.prices.length > 0) {
        // Group prices by set, then get best price per set
        const pricesBySet = {};

        for (const price of priceData.prices) {
          // Extract set info from title or tags
          const setName = this.extractSetName(price.name, price.tags) || 'Unknown Set';

          this.logger.debug(`RedClaw: "${card.Name}" - Product name: "${price.name}" -> Extracted set: "${setName}"`);

          if (!pricesBySet[setName] || price.price < pricesBySet[setName].price) {
            pricesBySet[setName] = { ...price, set: setName };
          }
        }

        this.logger.info(`RedClaw: "${card.Name}" - Found ${Object.keys(pricesBySet).length} unique sets: ${Object.keys(pricesBySet).join(', ')}`);

        // Create a result for each set
        for (const bestPriceForSet of Object.values(pricesBySet)) {
          const cardResult = new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(bestPriceForSet.price * 100), // Convert to cents
            set: bestPriceForSet.set,
            condition: 'Unknown', // RedClaw condition handling TBD
            inStock: bestPriceForSet.available,
            source: this.source,
            url: bestPriceForSet.url
          });

          this.logger.debug(`RedClaw: Creating result for "${card.Name}" from set "${bestPriceForSet.set}" - $${bestPriceForSet.price}`);
          results.push(cardResult);
        }

        this.logger.info(`RedClaw: "${card.Name}" - Created ${Object.keys(pricesBySet).length} CardResult objects`);
      } else {
        this.logger.info(`RedClaw: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, this.source));
      }

      // Add delay to be respectful to the API
      await this.delay(500);
    }

    return results;
  }

  parseSoldOutProduct(productHtml, cardName, productCount) {
    try {
      this.logger.info(`RedClaw: Attempting to parse sold out product #${productCount} for "${cardName}"`);

      // Debug: Log the first 1000 characters of sold out product HTML to understand structure
      this.logger.info(`RedClaw: Sold out product #${productCount} HTML sample: ${productHtml.substring(0, 1000)}`);

      // For sold out products, try to extract title from different HTML structures
      // Look for product title in various ways since onclick might not be available

      // Method 1: Look for productTitle class (most reliable for sold out products)
      // Extract content between <p class="productTitle"> and </p>, then split on <br>
      let productTitleMatch = productHtml.match(/<p\s+class="productTitle">(.*?)<\/p>/s);
      let cardTitle, setName;

      if (productTitleMatch) {
        const titleContent = productTitleMatch[1];
        // Split on <br> tag - everything before is card name, everything after is set name
        const brSplit = titleContent.split(/<br[^>]*>/);
        if (brSplit.length >= 2) {
          cardTitle = brSplit[0].trim();
          // Remove brackets from set name and clean up
          setName = brSplit[1].replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();
          this.logger.info(`RedClaw: Product #${productCount} - Found productTitle: "${cardTitle}" from set "${setName}"`);
        } else {
          this.logger.info(`RedClaw: Product #${productCount} - Could not split productTitle on <br> tag: "${titleContent}"`);
          return null;
        }
      } else {
        // Fallback methods for other structures
        let fullTitleMatch = productHtml.match(/title="([^"]*\[[^\]]+\][^"]*)"/);
        if (!fullTitleMatch) {
          // Method 3: Look for product name in alt text
          fullTitleMatch = productHtml.match(/alt="([^"]*\[[^\]]+\][^"]*)"/);
        }
        if (!fullTitleMatch) {
          // Method 4: Look for data attributes or other patterns
          fullTitleMatch = productHtml.match(/data-product-title="([^"]*\[[^\]]+\][^"]*)"/);
        }
        if (!fullTitleMatch) {
          // Method 5: Look for link text content
          fullTitleMatch = productHtml.match(/>([^<]*\[[^\]]+\][^<]*)</);
        }

        if (!fullTitleMatch) {
          this.logger.info(`RedClaw: Product #${productCount} - Could not extract title for sold out product "${cardName}"`);
          return null;
        }

        const fullTitle = fullTitleMatch[1].trim();
        this.logger.info(`RedClaw: Product #${productCount} - Found sold out product via fallback: "${fullTitle}"`);

        // Parse the title using same format as regular products
        const bracketMatch = fullTitle.match(/^(.*?)\s*\[([^\]]+)\]\s*(.*)$/);
        if (!bracketMatch) {
          this.logger.info(`RedClaw: Product #${productCount} - Could not parse sold out title format: "${fullTitle}"`);
          return null;
        }

        cardTitle = bracketMatch[1].trim();
        setName = bracketMatch[2].trim();
      }

      // Determine condition - for productTitle format, we need to extract it differently
      let condition = 'Unknown';
      if (!titleMatch) {
        // If we used fallback parsing, we might have condition info
        const bracketMatch = fullTitle.match(/^(.*?)\s*\[([^\]]+)\]\s*(.*)$/);
        if (bracketMatch && bracketMatch[3]) {
          condition = bracketMatch[3].replace(/^-\s*/, '').trim();
        }
      }

      if (!cardTitle || !setName) {
        this.logger.info(`RedClaw: Product #${productCount} - Could not extract card title or set for sold out product "${cardName}"`);
        return null;
      }

      const fullTitle = `${cardTitle} [${setName}]${condition ? ' - ' + condition : ''}`;

      // Try to extract original price from strikethrough or other elements
      let originalPrice = 0;
      const priceMatch = productHtml.match(/\$([0-9.]+)/);
      if (priceMatch) {
        originalPrice = parseFloat(priceMatch[1]);
      }

      this.logger.info(`RedClaw: Product #${productCount} - Parsed sold out: Card="${cardTitle}", Set="${setName}", Condition="${condition}", OriginalPrice=$${originalPrice}`);

      return {
        id: `redclaw-soldout-${productCount}`,
        productId: `soldout-${productCount}`,
        name: cardTitle,
        price: originalPrice,
        currencyCode: 'CAD',
        url: null,
        imageUrl: null,
        available: false, // Mark as not available
        sku: null,
        condition: condition || 'Unknown',
        vendor: 'RedClaw Gaming',
        productType: 'MTG Single',
        variantTitle: fullTitle,
        set: setName
      };

    } catch (error) {
      this.logger.error(`RedClaw: Error parsing sold out product #${productCount} for "${cardName}":`, error.message);
      return null;
    }
  }

  extractSetName(productName, tags = []) {
    // RedClaw format: "Lightning Bolt [Magic 2011]"
    // Try to extract set name from product title

    const bracketMatch = productName.match(/\[([^\]]+)\]$/);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    // Alternative patterns for RedClaw
    const dashMatch = productName.match(/\s-\s([^-\[]+)(?:\s+\[[^\]]+\])?$/);
    if (dashMatch) {
      return dashMatch[1].trim();
    }

    // Look for set names in tags if provided
    if (tags && tags.length > 0) {
      const setTags = tags.filter(tag =>
        tag.includes('set') ||
        tag.includes('edition') ||
        tag.includes('masters') ||
        tag.includes('commander') ||
        tag.includes('anthology') ||
        tag.includes('booster')
      );

      if (setTags.length > 0) {
        return setTags[0];
      }
    }

    // If no clear set pattern, try to extract from the end of the title
    // Look for known Magic set patterns
    const setPatterns = [
      /\b(Alpha|Beta|Unlimited|Revised|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Edition\b/i,
      /\b(Core Set \d{4}|Magic \d{4}|Magic Origins)\b/i,
      /\b(Innistrad|Zendikar|Ravnica|Mirrodin|Kamigawa|Shadowmoor|Lorwyn|Alara|Scars)\b/i,
      /\b(Masters \d{2,4}|Modern Masters|Eternal Masters|Ultimate Masters)\b/i,
      /\b(Commander \d{4}|Commander Legends|Commander Masters)\b/i,
      /\b(Secret Lair|Anthologies|Beatdown|Jumpstart|Mystery Booster)\b/i
    ];

    for (const pattern of setPatterns) {
      const match = productName.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }
}

module.exports = RedClawProcessor;