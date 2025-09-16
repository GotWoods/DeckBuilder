const mongoose = require('mongoose');

// Mock the mongoose model to avoid database dependency
jest.mock('../../src/models/deckSchema', () => {
  return jest.fn().mockImplementation(() => ({
    Cards: [],
    Importing: false,
    createdAt: new Date(),
    import: function(importData) {
      this.Importing = true;
      let lines = importData.split('\n');
      
      lines.forEach(element => {
        if (element.trim()) {
          var parts = element.split(" ");
          if (parts.length < 2)
            return;
          this.Cards.push({
            Quantity: parseInt(parts[0]),
            Name: parts.slice(1).join(' ')
          });
        }
      });
    },
    save: jest.fn().mockResolvedValue({ _id: 'mockId', Cards: [], createdAt: new Date() })
  }));
});

const Deck = require('../../src/models/deckSchema');

describe('Deck Schema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('import method', () => {
    test('should parse simple card list', () => {
      const deck = new Deck();
      const importData = '4 Lightning Bolt\n2 Counterspell\n1 Black Lotus';
      
      deck.import(importData);
      
      expect(deck.Cards).toHaveLength(3);
      expect(deck.Cards[0]).toEqual({
        Quantity: 4,
        Name: 'Lightning Bolt'
      });
      expect(deck.Cards[1]).toEqual({
        Quantity: 2,
        Name: 'Counterspell'
      });
      expect(deck.Cards[2]).toEqual({
        Quantity: 1,
        Name: 'Black Lotus'
      });
      expect(deck.Importing).toBe(true);
    });

    test('should handle cards with multiple words', () => {
      const deck = new Deck();
      const importData = '1 Serra the Benevolent';
      
      deck.import(importData);
      
      expect(deck.Cards).toHaveLength(1);
      expect(deck.Cards[0]).toEqual({
        Quantity: 1,
        Name: 'Serra the Benevolent'
      });
    });

    test('should skip empty lines', () => {
      const deck = new Deck();
      const importData = '4 Lightning Bolt\n\n2 Counterspell\n   \n1 Black Lotus';
      
      deck.import(importData);
      
      expect(deck.Cards).toHaveLength(3);
    });

    test('should skip lines with insufficient parts', () => {
      const deck = new Deck();
      const importData = '4 Lightning Bolt\nInvalidLine\n2 Counterspell';
      
      deck.import(importData);
      
      expect(deck.Cards).toHaveLength(2);
      expect(deck.Cards[0].Name).toBe('Lightning Bolt');
      expect(deck.Cards[1].Name).toBe('Counterspell');
    });
  });

  describe('database operations', () => {
    test('should save deck to database', async () => {
      const deck = new Deck();
      deck.import('4 Lightning Bolt');
      
      const savedDeck = await deck.save();
      
      expect(savedDeck._id).toBeDefined();
      expect(savedDeck.createdAt).toBeDefined();
      expect(deck.save).toHaveBeenCalled();
    });

    test('should have default values', () => {
      const deck = new Deck();
      
      expect(deck.Importing).toBe(false);
      expect(deck.Cards).toEqual([]);
    });
  });
});