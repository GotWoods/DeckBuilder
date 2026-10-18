const BaseBuylist = require('./baseBuylist');
const { parseTapsPage } = require('../../utils/buylistParsers');

class TapsBuylist extends BaseBuylist {
  constructor() {
    super({ source: 'taps', vendorName: 'Taps' });
    this.baseUrl = 'https://store.storepass.co/saas/search';
    this.storeId = 'afbPeXJ2EK';
    this.pageSize = 200;
  }

  fetchPage(page) {
    return this.get(this.baseUrl, {
      store_id: this.storeId,
      product_line: 'Magic: the Gathering',
      mongo: 'true',
      buylist_products: 'true',
      sort: 'Buy Price: High-Low',
      limit: this.pageSize,
      page
    });
  }

  parsePage(data) {
    return parseTapsPage(data);
  }
}

module.exports = TapsBuylist;
