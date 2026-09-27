const ShopifyStoreProcessor = require('./shopifyStoreProcessor');

class TimeVaultProcessor extends ShopifyStoreProcessor {
  constructor() {
    super({ source: 'timevault', host: 'thetimevault.ca', vendorName: 'TimeVault' });
  }
}

module.exports = TimeVaultProcessor;
