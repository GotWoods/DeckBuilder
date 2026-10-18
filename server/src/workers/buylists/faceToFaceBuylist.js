const BaseBuylist = require('./baseBuylist');
const { parseFaceToFacePage } = require('../../utils/buylistParsers');

class FaceToFaceBuylist extends BaseBuylist {
  constructor() {
    super({ source: 'facetoface', vendorName: 'Face to Face' });
    this.baseUrl = 'https://facetofacegames.com/apps/prod-indexer/search';
    this.collectionId = '616193786228'; // magic-the-gathering collection
    this.pageSize = 100;
  }

  fetchPage(page) {
    // Without the Singles filter sealed product leads the results
    return this.get(`${this.baseUrl}/collections/${this.collectionId}/pageSize/${this.pageSize}/page/${page}/sort/sell_price_desc/Product%20Type/Singles/withFacets/false`);
  }

  parsePage(data) {
    return parseFaceToFacePage(data);
  }
}

module.exports = FaceToFaceBuylist;
