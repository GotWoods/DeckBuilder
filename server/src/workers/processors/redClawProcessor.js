const ShopifyStoreProcessor = require('./shopifyStoreProcessor');

class RedClawProcessor extends ShopifyStoreProcessor {
  constructor() {
    super({ source: 'redclaw', host: 'www.redclawgaming.com', vendorName: 'RedClaw' });
  }
}

module.exports = RedClawProcessor;
