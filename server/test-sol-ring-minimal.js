const axios = require('axios');

async function testSolRingDirect() {
  console.log('Testing Sol Ring API directly...');

  const baseUrl = 'https://store.storepass.co/saas/search';
  const defaultParams = {
    store_id: 'afbPeXJ2EK',
    limit: 200,
    sort: 'Relevance',
    mongo: 'true',
    override_buylist_gt_price: 'true',
    product_line: 'All',
    fields: 'id,productId,availability,stock,selectedFinish,url,imageUrl,price,salePrice,regularPrice,name,variantInfo,bigCommerceImages,msrp,tags,publisher,inventoryLevels,customCollectionImages,display_name',
    convert_to_currency: '',
    round_price: '',
    big_commerce_category_ids: '',
    brand_name: '',
    shopify_collection_id: '',
    product_ids: '',
    product_handles: '',
    set_name: '',
    rarity: '',
    import_list_text: '',
    is_hot: '',
    players: '',
    playtime: '',
    min_year: '',
    max_year: '',
    min_price: '',
    max_price: '',
    product_type: '',
    publisher: '',
    designer: '',
    mechanic: '',
    category: '',
    type_line: '',
    color: '',
    finish: '',
    vendor: '',
    tags: '',
    exclude_tag: '',
    in_stock: ''
  };

  let allProducts = [];
  let currentPage = 1;
  let hasMorePages = true;

  try {
    while (hasMorePages) {
      const params = {
        ...defaultParams,
        name: 'Sol Ring',
        q: 'Sol Ring',
        page: currentPage
      };

      console.log(`\n=== PAGE ${currentPage} ===`);

      const response = await axios.get(baseUrl, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const products = response.data.products || [];
      console.log(`API returned ${products.length} raw products`);

      if (products.length > 0) {
        allProducts = allProducts.concat(products);

        // Show sample product names from this page
        console.log('Sample products from this page:');
        products.slice(0, 3).forEach((product, index) => {
          const name = product.display_name || product.name || 'No name';
          console.log(`  ${index + 1}. "${name}" - Stock: ${product.stock}`);
        });

        // Check pagination logic
        if (products.length < defaultParams.limit) {
          hasMorePages = false;
          console.log(`Page ${currentPage} returned ${products.length} results (< ${defaultParams.limit}), stopping pagination`);
        } else {
          console.log(`Page ${currentPage} returned ${products.length} results, checking next page`);
          currentPage++;
        }
      } else {
        hasMorePages = false;
        console.log(`Page ${currentPage} returned no results, stopping pagination`);
      }

      // Add delay between requests
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`\n=== FINAL RESULTS ===`);
    console.log(`Total products across ${currentPage} pages: ${allProducts.length}`);

    // Filter for actual Sol Ring products
    const solRingProducts = allProducts.filter(product => {
      const name = (product.display_name || product.name || '').toLowerCase();
      const cardTitle = name.replace(/\s*\[.*?\]\s*$/, '').trim();
      return cardTitle.startsWith('sol ring');
    });

    console.log(`Products that start with "Sol Ring": ${solRingProducts.length}`);

    // Find in-stock items
    const inStock = allProducts.filter(p => p.stock > 0);
    console.log(`Total in-stock items: ${inStock.length}`);

    const solRingInStock = solRingProducts.filter(p => p.stock > 0);
    console.log(`Sol Ring in-stock items: ${solRingInStock.length}`);

    if (solRingInStock.length > 0) {
      console.log('\n=== SOL RING IN-STOCK ITEMS ===');
      solRingInStock.forEach((product, index) => {
        const name = product.display_name || product.name || 'No name';
        console.log(`${index + 1}. "${name}" - Stock: ${product.stock} - Price: $${product.price}`);
      });
    }

    // Show first few Sol Ring products regardless of stock
    console.log('\n=== FIRST 10 SOL RING PRODUCTS ===');
    solRingProducts.slice(0, 10).forEach((product, index) => {
      const name = product.display_name || product.name || 'No name';
      console.log(`${index + 1}. "${name}" - Stock: ${product.stock} - Price: $${product.price}`);
    });

  } catch (error) {
    console.error('Error testing Sol Ring:', error.message);
  }
}

testSolRingDirect();