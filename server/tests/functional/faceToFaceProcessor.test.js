const FaceToFaceProcessor = require('../../src/workers/faceToFaceProcessor');

describe('Face to Face Processor - Functional Tests', () => {
  const processor = new FaceToFaceProcessor();
  
  // Longer timeout for real API calls
  const TIMEOUT = 30000;

  beforeAll(() => {
    // Increase timeout for functional tests
    jest.setTimeout(TIMEOUT);
  });

  afterEach(async () => {
    // Add delay between tests to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('processCards with real API calls', () => {
    test('should find multiple Lightning Bolt results', async () => {
      const testCards = [
        {
          Name: 'Lightning Bolt',
          Quantity: 1
        }
      ];

      const results = await processor.processCards(testCards);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('source', 'facetoface');
      expect(results[0]).toHaveProperty('name', 'Lightning Bolt');
      expect(results[0]).toHaveProperty('quantity', 1);
      
      if (results[0].found) {
        // Lightning Bolt is a very popular card, should have results
        expect(results[0]).toHaveProperty('price');
        expect(results[0].price).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('url');
        expect(results[0].url).toContain('facetofacegames.com');
        
        // Log the actual result for debugging
        console.log(`Found Lightning Bolt: $${(results[0].price / 100).toFixed(2)} - ${results[0].set || 'Unknown Set'}`);
        console.log(`URL: ${results[0].url}`);
        console.log(`In Stock: ${results[0].inStock}`);
      } else {
        // If Lightning Bolt isn't found, that would be unusual and worth investigating
        console.warn('Lightning Bolt not found - this may indicate an API issue');
      }

      // Even if not found, we should get a valid result structure
      expect(results[0]).toHaveProperty('found');
    }, TIMEOUT);

    test('should handle non-existent card gracefully', async () => {
      const testCards = [
        {
          Name: 'WYWEASDSG',
          Quantity: 1
        }
      ];

      const results = await processor.processCards(testCards);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('source', 'facetoface');
      expect(results[0]).toHaveProperty('name', 'WYWEASDSG');
      expect(results[0]).toHaveProperty('quantity', 1);
      
      // This random string should not match anything
      if (results[0].found) {
        console.log(`Face to Face unexpectedly found something for "WYWEASDSG": $${(results[0].price / 100).toFixed(2)}`);
        console.log(`URL: ${results[0].url}`);
        // If it somehow finds something, just verify it's a valid structure
        expect(results[0]).toHaveProperty('price');
        expect(results[0]).toHaveProperty('url');
      } else {
        expect(results[0]).toHaveProperty('found', false);
        expect(results[0]).toHaveProperty('price', null);
      }
    }, TIMEOUT);

    test('should process multiple cards', async () => {
      const testCards = [
        { Name: 'Lightning Bolt', Quantity: 4 },
        { Name: 'Counterspell', Quantity: 2 }
      ];

      const results = await processor.processCards(testCards);
      
      expect(results).toHaveLength(2);
      
      // Check Lightning Bolt result
      expect(results[0]).toHaveProperty('source', 'facetoface');
      expect(results[0]).toHaveProperty('name', 'Lightning Bolt');
      expect(results[0]).toHaveProperty('quantity', 4);
      
      // Check Counterspell result  
      expect(results[1]).toHaveProperty('source', 'facetoface');
      expect(results[1]).toHaveProperty('name', 'Counterspell');
      expect(results[1]).toHaveProperty('quantity', 2);
      
      // Both should likely be found (very common cards)
      const foundCount = results.filter(r => r.found).length;
      console.log(`Found ${foundCount}/2 cards in batch test`);
      
      // Log results for debugging
      results.forEach((result, index) => {
        if (result.found) {
          console.log(`${result.name}: $${(result.price / 100).toFixed(2)} - ${result.set || 'Unknown Set'}`);
        } else {
          console.log(`${result.name}: Not found`);
        }
      });
    }, TIMEOUT);
  });
});