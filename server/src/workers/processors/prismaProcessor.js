const ConductCommerceProcessor = require('./conductCommerceProcessor');

class PrismaProcessor extends ConductCommerceProcessor {
  constructor() {
    super({ source: 'prisma', host: 'www.prismatcg.com', vendorName: 'Prisma TCG' });
  }
}

module.exports = PrismaProcessor;
