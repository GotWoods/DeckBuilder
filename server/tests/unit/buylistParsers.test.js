const { parseTapsPage, parseFaceToFacePage } = require('../../src/utils/buylistParsers');
const tapsPage = require('../fixtures/tapsBuylistPage.json');
const faceToFacePage = require('../fixtures/faceToFaceBuylistPage.json');

describe('parseTapsPage', () => {
  const { entries, rawCount, topBuyCents } = parseTapsPage(tapsPage);

  test('reads near mint cash and credit buy prices in cents', () => {
    expect(rawCount).toBe(3);
    expect(entries[0]).toMatchObject({
      vendor: 'taps',
      name: 'Demonic Tutor',
      buyCashCents: 21753,
      buyCreditCents: 32630,
      retailCents: 49438
    });
  });

  test('extracts printing details from tags and display name', () => {
    expect(entries[0]).toMatchObject({
      set: 'Strixhaven Mystical Archive',
      setCode: 'STA',
      collectorNumber: '90',
      foil: true,
      finish: 'Foil Etched',
      treatment: 'JP Alternate Art Borderless'
    });
  });

  test('reports the lowest product buy price on the page', () => {
    expect(topBuyCents).toBe(20930);
  });

  test('handles an empty page', () => {
    expect(parseTapsPage({ products: [] })).toEqual({ entries: [], rawCount: 0, topBuyCents: 0 });
  });
});

describe('parseFaceToFacePage', () => {
  const { entries, rawCount, topBuyCents } = parseFaceToFacePage(faceToFacePage);

  test('uses the near mint variant sell price as the buy price', () => {
    expect(rawCount).toBe(3);
    expect(entries[0]).toMatchObject({
      vendor: 'facetoface',
      name: 'Black Lotus',
      set: 'Limited Edition Beta',
      setCode: 'LEB',
      collectorNumber: '233',
      foil: false,
      treatment: '',
      buyCashCents: 6000000,
      retailCents: 7999999,
      url: 'https://facetofacegames.com/products/black-lotus-233-limited-edition-beta-non-foil'
    });
  });

  test('reports the lowest product buy price on the page', () => {
    expect(topBuyCents).toBe(5131200);
  });

  test('accepts a card name indexed as an array', () => {
    const page = {
      hits: {
        hits: [{
          _source: {
            'Card Name': ['Fire', 'Ice'],
            Set: 'Apocalypse',
            variants: [{ sellPrice: 12, price: 20, selectedOptions: [{ name: 'Condition', value: 'NM' }] }]
          }
        }]
      }
    };

    expect(parseFaceToFacePage(page).entries[0]).toMatchObject({ name: 'Fire', buyCashCents: 1200 });
  });

  test('skips products without a near mint buy price', () => {
    const page = {
      hits: {
        hits: [{
          _source: {
            'Card Name': 'Sol Ring',
            variants: [{ sellPrice: 0, price: 2, selectedOptions: [{ name: 'Condition', value: 'NM' }] }]
          }
        }]
      }
    };

    expect(parseFaceToFacePage(page)).toMatchObject({ entries: [], rawCount: 1, topBuyCents: 0 });
  });
});
