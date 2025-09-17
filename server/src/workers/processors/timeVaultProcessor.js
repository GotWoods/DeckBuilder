const axios = require('axios');
const cheerio = require('cheerio');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

class TimeVaultProcessor extends BaseProcessor {
  constructor() {
    super();
    this.source = 'timevault';
    this.baseUrl = 'https://thetimevault.ca/search';
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);

      let allProducts = [];
      let currentPage = 1;
      let hasMorePages = true;

      this.logger.info(`Searching TimeVault for: ${cardName} (with pagination)`);

      while (hasMorePages) {
        const url = `${this.baseUrl}?q=${encodedCardName}*+product_type%3A%22mtg%22&page=${currentPage}`;

        this.logger.debug(`TimeVault: Fetching page ${currentPage} for "${cardName}"`);
        this.logger.info(`TimeVault URL: ${url}`);

        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        this.logger.info(`TimeVault response status: ${response.status} for "${cardName}" page ${currentPage}`);

        const pageResult = this.parseResponse(response.data, cardName, currentPage);

        if (pageResult.found && pageResult.prices.length > 0) {
          allProducts = allProducts.concat(pageResult.prices);

          // On first page, check pagination to determine total pages
          if (currentPage === 1) {
            const totalPages = this.extractTotalPages(response.data);
            if (totalPages > 1) {
              this.logger.info(`TimeVault: Found ${totalPages} total pages for "${cardName}"`);
              // Set hasMorePages based on actual total pages
              hasMorePages = currentPage < totalPages;
            } else {
              hasMorePages = false;
              this.logger.info(`TimeVault: Only 1 page found for "${cardName}"`);
            }
          } else {
            // For subsequent pages, use the total pages we found on page 1
            const totalPages = this.extractTotalPages(response.data);
            hasMorePages = currentPage < totalPages;
          }

          if (hasMorePages) {
            this.logger.info(`TimeVault: Page ${currentPage} returned ${pageResult.prices.length} results, continuing to next page for "${cardName}"`);
            currentPage++;
          } else {
            this.logger.info(`TimeVault: Page ${currentPage} was the last page for "${cardName}"`);
          }
        } else {
          hasMorePages = false;
          this.logger.info(`TimeVault: Page ${currentPage} returned no results, stopping pagination for "${cardName}"`);
        }

        // Add delay between requests to be respectful
        if (hasMorePages) {
          await this.delay(500);
        }
      }

      this.logger.info(`TimeVault: Found total of ${allProducts.length} products across ${currentPage} pages for "${cardName}"`);

      return {
        cardName,
        found: allProducts.length > 0,
        totalResults: allProducts.length,
        totalPages: currentPage,
        prices: allProducts,
        searchedAt: new Date()
      };

    } catch (error) {
      this.logger.error(`Error searching TimeVault for "${cardName}":`, error.message);
      return {
        cardName,
        found: false,
        prices: []
      };
    }
  }

  parseResponse(html, cardName, pageNumber = 1) {
    try {
      // Always try HTML parsing first as it's more reliable for TimeVault
      this.logger.info(`Attempting HTML parsing for "${cardName}" on page ${pageNumber}`);
      const htmlResult = this.parseHtmlResponse(html, cardName);

      if (htmlResult && htmlResult.found && htmlResult.prices && htmlResult.prices.length > 0) {
        this.logger.info(`HTML parsing successful for "${cardName}" - found ${htmlResult.prices.length} products`);
        return htmlResult;
      }

      this.logger.info(`All parsing methods failed for "${cardName}"`);
      return htmlResult; // Return the HTML result even if empty
    } catch (parseError) {
      this.logger.error(`Error parsing TimeVault response for "${cardName}":`, parseError.message);
      return {
        cardName,
        found: false,
        error: 'Failed to parse response',
        prices: []
      };
    }
  }

  parseHtmlResponse(html, cardName) {
    // Parse HTML using Cheerio for more reliable parsing
    try {
      this.logger.info(`Starting HTML parsing for "${cardName}"`);

      const $ = cheerio.load(html);
      const productElements = $('.product.Norm');

      this.logger.info(`HTML contains ${productElements.length} product divs for "${cardName}"`);

      if (productElements.length === 0) {
        this.logger.info(`TimeVault: No product divs found for "${cardName}"`);
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

        this.logger.info(`TimeVault: Processing product #${productCount} for "${cardName}"`);

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
                  this.logger.info(`TimeVault: Using actual price $${actualPrice} instead of onclick price $${priceValue} for "${cardName}"`);
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

              // Filter out cards that don't start with the search term
              if (!cardTitle.toLowerCase().startsWith(cardName.toLowerCase())) {
                this.logger.info(`TimeVault: Skipping non-matching product: "${cardTitle}" (doesn't start with "${cardName}")`);
                return; // Skip this product in the .each() loop
              }

              this.logger.info(`TimeVault: Found in-stock product: "${cardTitle}" from set "${setName}" at $${priceValue}`);

              products.push({
                id: `timevault-${productId}`,
                productId: productId,
                name: cardTitle,
                price: priceValue,
                currencyCode: 'CAD',
                url: null,
                imageUrl: null,
                available: true,
                sku: null,
                condition: condition,
                vendor: 'The Time Vault',
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
              const [cardNamePart, setWithBrackets] = titleHtml.split('<br>');
              const cardTitle = cardNamePart.trim();
              const setName = setWithBrackets.replace(/^\s*\[/, '').replace(/\]\s*$/, '').trim();

              // Filter out cards that don't start with the search term
              if (!cardTitle.toLowerCase().startsWith(cardName.toLowerCase())) {
                this.logger.info(`TimeVault: Skipping non-matching sold-out product: "${cardTitle}" (doesn't start with "${cardName}")`);
                return; // Skip this product in the .each() loop
              }

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

              this.logger.info(`TimeVault: Found sold-out product: "${cardTitle}" from set "${setName}"`);

              products.push({
                id: `timevault-soldout-${productCount}`,
                productId: `soldout-${productCount}`,
                name: cardTitle,
                price: originalPrice,
                currencyCode: 'CAD',
                url: null,
                imageUrl: null,
                available: false,
                sku: null,
                condition: 'Unknown',
                vendor: 'The Time Vault',
                productType: 'MTG Single',
                variantTitle: `${cardTitle} [${setName}]`,
                set: setName
              });
            }
          } else {
            this.logger.info(`TimeVault: Product #${productCount} - No onclick or productTitle found for "${cardName}"`);
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

  async processCards(cards) {
    const results = [];

    for (const card of cards) {
      this.logger.debug(`Processing ${card.Quantity}x ${card.Name} with TimeVault`);

      const priceData = await this.searchCard(card.Name);

      if (priceData.found && priceData.prices.length > 0) {
        // Group prices by set, then get best price per set
        const pricesBySet = {};
        for (const price of priceData.prices) {
          const setName = price.set || 'Unknown Set';
          if (!pricesBySet[setName] || price.price < pricesBySet[setName].price) {
            pricesBySet[setName] = { ...price, set: setName };
          }
        }

        this.logger.info(`TimeVault: "${card.Name}" - Found ${Object.keys(pricesBySet).length} unique sets: ${Object.keys(pricesBySet).join(', ')}`);

        // Create a result for each set
        for (const bestPriceForSet of Object.values(pricesBySet)) {
          const cardResult = new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(bestPriceForSet.price * 100), // Convert to cents
            set: bestPriceForSet.set,
            condition: 'Unknown', // TimeVault condition handling TBD
            inStock: bestPriceForSet.available,
            source: this.source,
            url: bestPriceForSet.url
          });

          this.logger.debug(`TimeVault: Creating result for "${card.Name}" from set "${bestPriceForSet.set}" - $${bestPriceForSet.price}`);
          results.push(cardResult);
        }

        this.logger.info(`TimeVault: "${card.Name}" - Created ${Object.keys(pricesBySet).length} CardResult objects`);
      } else {
        this.logger.info(`TimeVault: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, this.source));
      }

      // Add delay to be respectful to the API
      await this.delay(500);
    }

    return results;
  }

  extractSetName(productName, tags = []) {
    // TimeVault format: "Lightning Bolt [Magic 2011]"
    // Try to extract set name from product title

    const bracketMatch = productName.match(/\[([^\]]+)\]$/);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    // Alternative patterns for TimeVault
    const dashMatch = productName.match(/\s-\s([^-\[]+)(?:\s+\[[^\]]+\])?$/);
    if (dashMatch) {
      return dashMatch[1].trim();
    }

    // Look for set names in tags if provided
    if (tags && tags.length > 0) {
      const setTags = tags.filter(tag =>
        tag.includes('set') ||
        tag.includes('edition') ||
        tag.includes('block') ||
        tag.includes('expansion') ||
        tag.includes('series')
      );

      if (setTags.length > 0) {
        return setTags[0];
      }
    }

    // If no clear set pattern, try to extract from the end of the title
    // Look for known Magic set patterns
    const setPatterns = [
      /\b(Alpha|Beta|Unlimited|Revised|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+Edition\b/i,
      /\b(Ice Age|Alliances|Coldsnap)\b/i,
      /\b(Mirage|Visions|Weatherlight)\b/i,
      /\b(Tempest|Stronghold|Exodus)\b/i,
      /\b(Urza's Saga|Urza's Legacy|Urza's Destiny)\b/i,
      /\b(Mercadian Masques|Nemesis|Prophecy)\b/i
    ];

    for (const pattern of setPatterns) {
      const match = productName.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  extractTotalPages(html) {
    try {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      // Find all page number links in the pagination div
      const pageNumbers = [];
      $('#pagination .pages a.page-num').each((index, element) => {
        const href = $(element).attr('href');
        if (href) {
          const pageMatch = href.match(/page=(\d+)/);
          if (pageMatch) {
            pageNumbers.push(parseInt(pageMatch[1]));
          }
        }
      });

      // Also check for the current page (which might not be a link)
      $('#pagination .pages').each((index, element) => {
        const text = $(element).text().trim();
        if (/^\d+$/.test(text)) {
          pageNumbers.push(parseInt(text));
        }
      });

      if (pageNumbers.length > 0) {
        const maxPage = Math.max(...pageNumbers);
        this.logger.debug(`TimeVault: Extracted page numbers: [${pageNumbers.join(', ')}], max page: ${maxPage}`);
        return maxPage;
      }

      // Fallback: if no pagination found, assume single page
      this.logger.debug(`TimeVault: No pagination found, assuming single page`);
      return 1;
    } catch (error) {
      this.logger.error(`Error extracting total pages:`, error.message);
      return 1;
    }
  }
}

module.exports = TimeVaultProcessor;