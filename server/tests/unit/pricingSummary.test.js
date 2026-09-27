const { summarizePricing } = require('../../src/utils/pricingSummary');

const listing = (overrides) => ({
  found: true,
  source: 'redclaw',
  set: 'Alpha',
  condition: 'Near Mint',
  inStock: true,
  price: 1000,
  ...overrides
});

describe('summarizePricing', () => {
  test('stats cover every priced listing including out of stock', () => {
    const { stats } = summarizePricing([
      listing({ price: 1000 }),
      listing({ price: 3000, inStock: false, set: 'Beta' }),
      listing({ price: 500, inStock: false, set: 'Beta', condition: 'Damaged' }),
      { found: false, source: 'taps', price: null }
    ]);

    expect(stats).toEqual({ min: 500, max: 3000, avg: 1500, count: 3 });
  });

  test('keeps cheapest in-stock per vendor + set + condition', () => {
    const { results } = summarizePricing([
      listing({ price: 1200 }),
      listing({ price: 1000 }),
      listing({ price: 800, condition: 'Lightly Played' }),
      listing({ price: 900, source: 'taps' })
    ]);

    expect(results.map(r => `${r.source}:${r.condition}:${r.price}`).sort()).toEqual([
      'redclaw:Lightly Played:800',
      'redclaw:Near Mint:1000',
      'taps:Near Mint:900'
    ]);
  });

  test('in-stock wins over a cheaper out-of-stock listing in the same set', () => {
    const { results } = summarizePricing([
      listing({ price: 1000 }),
      listing({ price: 0 + 400, inStock: false, condition: 'Damaged' })
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ price: 1000, inStock: true });
  });

  test('keeps cheapest out-of-stock per vendor + set when nothing in stock', () => {
    const { results } = summarizePricing([
      listing({ price: 900, inStock: false }),
      listing({ price: 400, inStock: false, condition: 'Damaged' })
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ price: 400, inStock: false });
  });

  test('ignores zero prices and keeps not-found results', () => {
    const notFound = { found: false, source: 'taps', price: null };
    const { results, stats } = summarizePricing([listing({ price: 0 }), notFound]);

    expect(stats).toBeNull();
    expect(results).toEqual([notFound]);
  });
});
