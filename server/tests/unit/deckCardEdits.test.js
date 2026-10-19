jest.mock('../../src/models/deckSchema', () => {
  const actual = jest.requireActual('../../src/models/deckSchema');
  return {
    __esModule: true,
    default: { findOne: jest.fn() },
    parseDeckLines: actual.parseDeckLines
  };
});
jest.mock('../../src/utils/deckQueue', () => ({ add: jest.fn().mockResolvedValue({ id: 'job1' }) }));
jest.mock('../../src/config/logger', () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const Deck = require('../../src/models/deckSchema').default;
const deckQueue = require('../../src/utils/deckQueue');
const deckController = require('../../src/controllers/deckController').default;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockDeck = (overrides = {}) => ({
  Importing: false,
  colorIdentity: ['G', 'R'],
  Cards: [
    { Name: 'Sol Ring', Quantity: 1, colorIdentity: [] },
    { Name: 'Lightning Bolt', Quantity: 2, colorIdentity: ['R'] },
    { Name: 'Llanowar Elves', Quantity: 1, colorIdentity: ['G'] }
  ],
  save: jest.fn().mockResolvedValue(),
  ...overrides
});

describe('deckController card edits', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('addCards', () => {
    test('appends new cards, bumps existing quantities and queues unpriced pricing', async () => {
      const deck = mockDeck();
      Deck.findOne.mockResolvedValue(deck);
      const res = mockRes();

      await deckController.addCards(
        { params: { deckId: 'd1' }, body: { cards: '1 sol ring\n1 Last Breath (2X2) 15 *F*' }, user: { id: 'u1' } },
        res
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(deck.Cards.map(c => [c.Name, c.Quantity])).toEqual([
        ['Sol Ring', 2], ['Lightning Bolt', 2], ['Llanowar Elves', 1], ['Last Breath', 1]
      ]);
      expect(deck.Importing).toBe(true);
      expect(deckQueue.add).toHaveBeenCalledWith('processDeck', { deckId: 'd1', onlyUnpriced: true }, expect.any(Object));
    });

    test('does not queue pricing when only quantities change', async () => {
      const deck = mockDeck();
      Deck.findOne.mockResolvedValue(deck);
      const res = mockRes();

      await deckController.addCards({ params: { deckId: 'd1' }, body: { cards: '3 Lightning Bolt' } }, res);

      expect(deck.Cards[1].Quantity).toBe(5);
      expect(deck.Importing).toBe(false);
      expect(deckQueue.add).not.toHaveBeenCalled();
    });

    test('rejects input with no valid lines', async () => {
      Deck.findOne.mockResolvedValue(mockDeck());
      const res = mockRes();

      await deckController.addCards({ params: { deckId: 'd1' }, body: { cards: 'Sideboard' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects while the deck is processing', async () => {
      Deck.findOne.mockResolvedValue(mockDeck({ Importing: true }));
      const res = mockRes();

      await deckController.addCards({ params: { deckId: 'd1' }, body: { cards: '1 Opt' } }, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('removeCard', () => {
    test('removes the card and recalculates color identity', async () => {
      const deck = mockDeck();
      Deck.findOne.mockResolvedValue(deck);
      const res = mockRes();

      await deckController.removeCard({ params: { deckId: 'd1', cardIndex: '2' } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(deck.Cards.map(c => c.Name)).toEqual(['Sol Ring', 'Lightning Bolt']);
      expect(deck.colorIdentity).toEqual(['R']);
      expect(deck.save).toHaveBeenCalled();
    });

    test('rejects an out-of-range index', async () => {
      Deck.findOne.mockResolvedValue(mockDeck());
      const res = mockRes();

      await deckController.removeCard({ params: { deckId: 'd1', cardIndex: '9' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects while the deck is processing', async () => {
      Deck.findOne.mockResolvedValue(mockDeck({ Importing: true }));
      const res = mockRes();

      await deckController.removeCard({ params: { deckId: 'd1', cardIndex: '0' } }, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });
  });
});
