const ConductCommerceProcessor = require('./conductCommerceProcessor');

class CerberusProcessor extends ConductCommerceProcessor {
  constructor() {
    super({ source: 'cerberus', host: 'cerberusgamingcorp.com', vendorName: 'Cerberus Gaming' });
  }
}

module.exports = CerberusProcessor;
