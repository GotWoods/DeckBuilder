const { titleMatchesCardName, normalizeName, frontFace } = require('../../src/utils/cardIdentity');

describe('cardIdentity name matching', () => {
  test('treats single and double slash face separators as equal', () => {
    expect(titleMatchesCardName('Dusk // Dawn', 'Dusk / Dawn')).toBe(true);
    expect(titleMatchesCardName('Dusk / Dawn', 'Dusk // Dawn')).toBe(true);
  });

  test('matches a searched front face against a two-faced title', () => {
    expect(titleMatchesCardName('Dusk // Dawn', 'Dusk')).toBe(true);
  });

  test('ignores case, quotes and extra whitespace', () => {
    expect(titleMatchesCardName("Urza's   Saga", 'urzas saga')).toBe(true);
  });

  test('rejects titles that do not start with the card name', () => {
    expect(titleMatchesCardName('Dawn to Dusk', 'Dusk / Dawn')).toBe(false);
  });

  test('normalizeName and frontFace use the front face for either separator', () => {
    expect(normalizeName('Dusk / Dawn')).toBe(normalizeName('Dusk // Dawn'));
    expect(frontFace('Dusk / Dawn')).toBe('Dusk');
  });
});
