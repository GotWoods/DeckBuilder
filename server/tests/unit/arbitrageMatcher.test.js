const { matchListing, findOpportunities } = require('../../src/utils/arbitrageMatcher');
const {
  conductCommerceListings,
  shopifyStoreListings,
  tapsListings
} = require('../../src/utils/listingNormalizers');

const entry = (overrides) => ({
  vendor: 'facetoface',
  name: 'Demonic Tutor',
  set: 'Ultimate Masters',
  setCode: 'UMA',
  collectorNumber: '93',
  foil: false,
  finish: 'Non-Foil',
  treatment: '',
  buyCashCents: 8000,
  buyCreditCents: null,
  url: 'https://buy.example/demonic-tutor',
  ...overrides
});

const listing = (overrides) => ({
  source: 'redclaw',
  name: 'Demonic Tutor',
  set: 'Ultimate Masters',
  setCode: null,
  collectorNumber: null,
  foil: false,
  finish: 'Non-Foil',
  treatment: '',
  condition: 'Near Mint',
  priceCents: 6000,
  inStock: true,
  url: 'https://sell.example/demonic-tutor',
  ...overrides
});

describe('matchListing', () => {
  test('matches on name, set and finish when the seller has no collector number', () => {
    expect(matchListing(entry(), listing())).toEqual({ exact: false });
  });

  test('matches exactly on set code and collector number despite set name differences', () => {
    const seller = listing({ source: 'taps', set: 'UMA', setCode: 'uma', collectorNumber: '093' });
    expect(matchListing(entry(), seller)).toEqual({ exact: true });
  });

  test('tolerates punctuation and plural differences in set names', () => {
    const buy = entry({ set: 'Strixhaven: Mystical Archives', collectorNumber: null });
    expect(matchListing(buy, listing({ set: 'Strixhaven Mystical Archive' }))).toEqual({ exact: false });
  });

  test('matches special treatments regardless of word order', () => {
    const buy = entry({ collectorNumber: null, treatment: 'Anime Borderless' });
    expect(matchListing(buy, listing({ treatment: 'Borderless Anime Borderless' }))).toEqual({ exact: false });
  });

  test('rejects a different special treatment', () => {
    const buy = entry({ collectorNumber: null, treatment: 'Retro Frame Serialized' });
    expect(matchListing(buy, listing({ treatment: 'Retro Frame' }))).toBeNull();
  });

  test.each([
    ['the buying vendor itself', { source: 'facetoface' }],
    ['out of stock', { inStock: false }],
    ['played condition', { condition: 'Lightly Played' }],
    ['a different finish', { foil: true }],
    ['a different set', { set: 'Revised Edition' }],
    ['a different collector number', { setCode: 'UMA', collectorNumber: '94' }],
    ['a special treatment of a default printing', { treatment: 'Extended Art' }],
    ['a different card', { name: 'Demonic Tutelage' }]
  ])('rejects %s', (description, overrides) => {
    expect(matchListing(entry(), listing(overrides))).toBeNull();
  });
});

describe('findOpportunities', () => {
  test('computes margin against the cash buy price', () => {
    const [opportunity] = findOpportunities([entry()], [listing()]);

    expect(opportunity).toMatchObject({
      buyVendor: 'facetoface',
      sellVendor: 'redclaw',
      buyCashCents: 8000,
      sellPriceCents: 6000,
      marginCents: 2000,
      marginPct: 33.3,
      needsReview: false
    });
  });

  test('ignores listings priced at or above the buy price', () => {
    expect(findOpportunities([entry()], [listing({ priceCents: 8000 })])).toEqual([]);
  });

  test('keeps the cheapest listing per selling vendor, best margin first', () => {
    const opportunities = findOpportunities([entry()], [
      listing({ priceCents: 7000 }),
      listing({ priceCents: 6500 }),
      listing({ source: 'prisma', priceCents: 5000 })
    ]);

    expect(opportunities.map(o => `${o.sellVendor}:${o.sellPriceCents}`)).toEqual([
      'prisma:5000',
      'redclaw:6500'
    ]);
  });

  test('flags inexact matches when the buylist has several printings in the set', () => {
    const opportunities = findOpportunities(
      [entry(), entry({ collectorNumber: '300', buyCashCents: 9000 })],
      [listing()]
    );

    expect(opportunities).toHaveLength(2);
    expect(opportunities.every(o => o.needsReview)).toBe(true);
  });

  test('flags special finishes the seller cannot distinguish', () => {
    const [opportunity] = findOpportunities(
      [entry({ foil: true, finish: 'Etched Foil' })],
      [listing({ foil: true, finish: 'Foil' })]
    );

    expect(opportunity.needsReview).toBe(true);
  });
});

describe('listing normalizers', () => {
  test('conduct commerce splits treatment and finish from the name', () => {
    const [result] = conductCommerceListings({
      name: 'Sol Ring - Foil Extended Art',
      set: 'Secret Lair Drop',
      finish: 'Foil',
      condition: 'NM/Mint',
      price: 12.5,
      stock: 2
    }, 'cerberus');

    expect(result).toMatchObject({
      source: 'cerberus',
      name: 'Sol Ring',
      foil: true,
      treatment: 'Extended Art',
      priceCents: 1250,
      inStock: true
    });
  });

  test('shopify stores read the finish from the variant label', () => {
    const [result] = shopifyStoreListings({
      name: 'Sol Ring (Extended Art)',
      set: 'Commander Masters',
      condition: 'Near Mint Foil',
      price: 0.3,
      inStock: true
    }, 'redclaw');

    expect(result).toMatchObject({ name: 'Sol Ring', foil: true, treatment: 'Extended Art', priceCents: 30 });
  });

  test('taps emits one listing per condition with its own stock', () => {
    const results = tapsListings({
      displayName: 'Demonic Tutor (UMA-093) [Ultimate Masters]',
      price: 109.99,
      url: 'https://tapsgames.com/products/demonic-tutor-uma-093-ultimate-masters',
      variants: [
        { title: 'Near Mint', price: 109.99, inventory_quantity: 1 },
        { title: 'Lightly Played', price: 98.99, inventory_quantity: 0 }
      ]
    }, 'taps');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      name: 'Demonic Tutor',
      set: 'Ultimate Masters',
      setCode: 'UMA',
      collectorNumber: '093',
      foil: false,
      condition: 'Near Mint',
      priceCents: 10999,
      inStock: true
    });
    expect(results[1].inStock).toBe(false);
  });
});
