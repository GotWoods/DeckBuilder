const CardResult = require('../../src/models/cardResult');

describe('CardResult', () => {
  describe('constructor', () => {
    test('should create CardResult with all properties', () => {
      const options = {
        name: 'Lightning Bolt',
        quantity: 4,
        price: 150, // $1.50 in cents
        set: 'Alpha',
        condition: 'NM',
        inStock: true,
        source: 'teststore',
        url: 'https://example.com/lightning-bolt'
      };

      const result = new CardResult(options);

      expect(result.name).toBe('Lightning Bolt');
      expect(result.quantity).toBe(4);
      expect(result.price).toBe(150);
      expect(result.set).toBe('Alpha');
      expect(result.condition).toBe('NM');
      expect(result.inStock).toBe(true);
      expect(result.source).toBe('teststore');
      expect(result.url).toBe('https://example.com/lightning-bolt');
      expect(result.found).toBe(true);
    });

    test('should create CardResult with defaults', () => {
      const result = new CardResult();

      expect(result.name).toBe('');
      expect(result.quantity).toBe(0);
      expect(result.price).toBe(null);
      expect(result.set).toBe(null);
      expect(result.condition).toBe(null);
      expect(result.inStock).toBe(false);
      expect(result.source).toBe('unknown');
      expect(result.url).toBe(null);
      expect(result.found).toBe(false);
    });

    test('should set found to true when price is provided', () => {
      const result = new CardResult({ price: 100 });
      expect(result.found).toBe(true);
    });

    test('should set found to false when price is null', () => {
      const result = new CardResult({ price: null });
      expect(result.found).toBe(false);
    });
  });

  describe('getPriceFormatted', () => {
    test('should format price correctly', () => {
      const result = new CardResult({ price: 150 }); // $1.50
      expect(result.getPriceFormatted()).toBe('$1.50');
    });

    test('should handle zero price', () => {
      const result = new CardResult({ price: 0 });
      expect(result.getPriceFormatted()).toBe('$0.00');
      expect(result.found).toBe(true); // 0 is a valid price
    });

    test('should return null for null price', () => {
      const result = new CardResult({ price: null });
      expect(result.getPriceFormatted()).toBe(null);
    });

    test('should handle large prices', () => {
      const result = new CardResult({ price: 999999 }); // $9,999.99
      expect(result.getPriceFormatted()).toBe('$9999.99');
    });
  });

  describe('notFound static method', () => {
    test('should create not found CardResult', () => {
      const result = CardResult.notFound('Black Lotus', 1, 'teststore');

      expect(result.name).toBe('Black Lotus');
      expect(result.quantity).toBe(1);
      expect(result.source).toBe('teststore');
      expect(result.price).toBe(null);
      expect(result.inStock).toBe(false);
      expect(result.found).toBe(false);
      expect(result.url).toBe(null);
    });
  });

  describe('url field', () => {
    test('should store URL when provided', () => {
      const result = new CardResult({
        name: 'Lightning Bolt',
        quantity: 1,
        source: 'teststore',
        url: 'https://teststore.com/lightning-bolt'
      });

      expect(result.url).toBe('https://teststore.com/lightning-bolt');
    });

    test('should default to null when URL not provided', () => {
      const result = new CardResult({
        name: 'Lightning Bolt',
        quantity: 1,
        source: 'teststore'
      });

      expect(result.url).toBe(null);
    });
  });

  describe('isValid', () => {
    test('should return true for valid CardResult', () => {
      const result = new CardResult({
        name: 'Lightning Bolt',
        quantity: 4,
        source: 'teststore'
      });

      expect(result.isValid()).toBe(true);
    });

    test('should return false when name is missing', () => {
      const result = new CardResult({
        quantity: 4,
        source: 'teststore'
      });

      expect(result.isValid()).toBe(false);
    });

    test('should return false when quantity is zero', () => {
      const result = new CardResult({
        name: 'Lightning Bolt',
        quantity: 0,
        source: 'teststore'
      });

      expect(result.isValid()).toBe(false);
    });

    test('should return false when quantity is not a number', () => {
      const result = new CardResult({
        name: 'Lightning Bolt',
        quantity: 'four',
        source: 'teststore'
      });

      expect(result.isValid()).toBe(false);
    });

    test('should return false when source is missing or unknown', () => {
      const result1 = new CardResult({
        name: 'Lightning Bolt',
        quantity: 4
      }); // source defaults to 'unknown'

      expect(result1.isValid()).toBe(false);

      const result2 = new CardResult({
        name: 'Lightning Bolt',
        quantity: 4,
        source: ''
      });

      expect(result2.isValid()).toBe(false);
    });
  });
});