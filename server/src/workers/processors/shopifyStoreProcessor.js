const axios = require('axios');
const cheerio = require('cheerio');
const BaseProcessor = require('./baseProcessor');
const { CardResult } = require('../../models/cardResult');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Shared processor for Shopify card stores using the "product Norm" search theme
 * (RedClaw, TimeVault). Subclasses supply source, host and vendorName.
 */
class ShopifyStoreProcessor extends BaseProcessor {
  constructor({ source, host, vendorName }) {
    super();
    this.source = source;
    this.host = host;
    this.vendorName = vendorName;
    this.baseUrl = `https://${host}`;
  }

  async searchCard(cardName) {
    try {
      const encodedCardName = encodeURIComponent(cardName);
      let allProducts = [];
      let currentPage = 1;
      let hasMorePages = true;

      this.logger.info(`Searching ${this.vendorName} for: ${cardName} (with pagination)`);

      while (hasMorePages) {
        const url = `${this.baseUrl}/search?q=${encodedCardName}*+product_type%3A%22mtg%22&page=${currentPage}`;
        this.logger.debug(`${this.vendorName} URL: ${url}`);

        const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
        const pageProducts = await this.parseHtmlResponse(response.data, cardName);

        if (pageProducts.length > 0) {
          allProducts = allProducts.concat(pageProducts);
          hasMorePages = currentPage < this.extractTotalPages(response.data);
          if (hasMorePages) {
            currentPage++;
            await this.delay(500);
          }
        } else {
          hasMorePages = false;
        }
      }

      this.logger.info(`${this.vendorName}: Found ${allProducts.length} listings across ${currentPage} pages for "${cardName}"`);

      return {
        cardName,
        found: allProducts.length > 0,
        totalResults: allProducts.length,
        totalPages: currentPage,
        prices: allProducts,
        searchedAt: new Date()
      };
    } catch (error) {
      this.logger.error(`Error searching ${this.vendorName} for "${cardName}":`, error.message);
      return { cardName, found: false, prices: [] };
    }
  }

  /**
   * Returns one listing per variant. In-stock variants are read from the search page;
   * sold-out products show no price there, so their variants come from the product JSON.
   */
  async parseHtmlResponse(html, cardName) {
    const $ = cheerio.load(html);
    const listings = [];
    const soldOutProducts = [];

    $('.product.Norm').each((index, element) => {
      const $product = $(element);

      const titleHtml = $product.find('p.productTitle').html();
      if (!titleHtml || !titleHtml.includes('<br>')) return;

      const [cardNamePart, setPart] = titleHtml.split('<br>');
      const cardTitle = cheerio.load(cardNamePart).text().trim();
      const setName = cheerio.load(setPart).text().trim().replace(/^\[/, '').replace(/\]$/, '');

      if (!cardTitle.toLowerCase().startsWith(cardName.toLowerCase())) {
        this.logger.debug(`${this.vendorName}: Skipping non-matching product: "${cardTitle}"`);
        return;
      }

      const href = $product.find('a.productLink, a.productLink-NoStock').attr('href') || '';
      const handle = href.split('?')[0].replace(/^\/products\//, '');
      const url = handle ? `${this.baseUrl}/products/${handle}` : null;

      const $variants = $product.find('[onclick*="addToCart"]');
      if ($variants.length === 0) {
        if (handle) soldOutProducts.push({ handle, cardTitle, setName, url });
        return;
      }

      // Each addToCart button is an in-stock variant, labelled e.g. "Near Mint Foil - $0.30"
      $variants.each((i, variantElement) => {
        const label = $(variantElement).find('p').text().trim();
        const labelMatch = label.match(/^(.*?)\s*-\s*\$([0-9.,]+)/);
        if (!labelMatch) return;

        const price = parseFloat(labelMatch[2].replace(/,/g, ''));
        if (!(price > 0)) return;

        listings.push({
          name: cardTitle,
          set: setName,
          condition: labelMatch[1].trim() || 'Unknown',
          price,
          inStock: true,
          url
        });
      });
    });

    // Fetch a few at a time; popular cards can have dozens of sold-out printings
    for (let i = 0; i < soldOutProducts.length; i += 4) {
      const chunk = soldOutProducts.slice(i, i + 4);
      const variants = await Promise.all(chunk.map(product => this.fetchProductVariants(product)));
      listings.push(...variants.flat());
      await this.delay(250);
    }

    return listings;
  }

  async fetchProductVariants({ handle, cardTitle, setName, url }) {
    try {
      const response = await axios.get(`${this.baseUrl}/products/${handle}.js`, {
        headers: { 'User-Agent': USER_AGENT }
      });

      return (response.data.variants || [])
        .filter(variant => variant.price > 0)
        .map(variant => ({
          name: cardTitle,
          set: setName,
          condition: variant.title || 'Unknown',
          price: variant.price / 100, // Shopify product JSON prices are in cents
          inStock: !!variant.available,
          url
        }));
    } catch (error) {
      this.logger.warn(`${this.vendorName}: Failed to fetch variants for "${handle}": ${error.message}`);
      return [];
    }
  }

  async processCards(cards) {
    const results = [];

    for (const card of cards) {
      const priceData = await this.searchCard(card.Name);

      if (priceData.found && priceData.prices.length > 0) {
        for (const listing of priceData.prices) {
          results.push(new CardResult({
            name: card.Name,
            quantity: card.Quantity,
            price: Math.round(listing.price * 100), // Convert to cents
            set: listing.set,
            condition: listing.condition,
            inStock: listing.inStock,
            source: this.source,
            url: listing.url
          }));
        }
        this.logger.info(`${this.vendorName}: "${card.Name}" - Created ${priceData.prices.length} CardResult objects`);
      } else {
        this.logger.info(`${this.vendorName}: "${card.Name}" - No prices found, creating not-found result`);
        results.push(this.createNotFoundResult(card, this.source));
      }

      await this.delay(500);
    }

    return results;
  }

  extractTotalPages(html) {
    try {
      const $ = cheerio.load(html);
      const pageNumbers = [];

      $('#pagination .pages a.page-num').each((index, element) => {
        const pageMatch = ($(element).attr('href') || '').match(/page=(\d+)/);
        if (pageMatch) pageNumbers.push(parseInt(pageMatch[1]));
      });

      return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
    } catch (error) {
      this.logger.error(`Error extracting total pages:`, error.message);
      return 1;
    }
  }
}

module.exports = ShopifyStoreProcessor;
