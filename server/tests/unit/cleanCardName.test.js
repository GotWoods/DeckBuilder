const { cleanCardName } = jest.requireActual('../../src/models/deckSchema');

describe('cleanCardName', () => {
  test.each([
    ['Last Breath (2X2) 15 *F*', 'Last Breath'],
    ['Sol Ring (C21) 263 *E*', 'Sol Ring'],
    ['Lightning Bolt (SLD) 433', 'Lightning Bolt'],
    ['Opt (PLST) WOE-267', 'Opt'],
    ['Counterspell *F*', 'Counterspell'],
    ['Serra the Benevolent', 'Serra the Benevolent'],
  ])('%s -> %s', (raw, expected) => {
    expect(cleanCardName(raw)).toBe(expected);
  });
});
