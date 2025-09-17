const TapsProcessor = require('./server/src/workers/processors/tapsProcessor');

async function testSolRing() {
  console.log('Starting Sol Ring test...');

  const processor = new TapsProcessor();

  try {
    const result = await processor.searchCard('Sol Ring');

    console.log('\n=== SOL RING TEST RESULTS ===');
    console.log(`Found: ${result.found}`);
    console.log(`Total Results: ${result.totalResults}`);
    console.log(`Total Pages: ${result.totalPages}`);
    console.log(`Prices Array Length: ${result.prices?.length || 0}`);

    if (result.prices && result.prices.length > 0) {
      console.log('\n=== FIRST 5 PRODUCTS ===');
      result.prices.slice(0, 5).forEach((price, index) => {
        console.log(`${index + 1}. ${price.displayName || price.name} - Stock: ${price.stock} - Price: $${price.price}`);
      });

      console.log('\n=== IN-STOCK PRODUCTS ===');
      const inStock = result.prices.filter(p => p.stock > 0);
      console.log(`Found ${inStock.length} in-stock items:`);
      inStock.forEach((price, index) => {
        console.log(`${index + 1}. ${price.displayName || price.name} - Stock: ${price.stock} - Price: $${price.price}`);
      });

      console.log('\n=== SAMPLE PRODUCT NAMES ===');
      result.prices.slice(0, 10).forEach((price, index) => {
        console.log(`${index + 1}. Raw: "${price.displayName || price.name}"`);
      });
    }

  } catch (error) {
    console.error('Error testing Sol Ring:', error);
  }
}

testSolRing();