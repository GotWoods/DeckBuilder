const BaseProcessor = require('../../src/workers/baseProcessor');
const { CardResult } = require('../../src/models/cardResult');

describe('BaseProcessor', () => {
  test('should throw error when processCards is not implemented', async () => {
    const processor = new BaseProcessor();
    
    await expect(processor.processCards([])).rejects.toThrow(
      'processCards method must be implemented by subclass'
    );
  });

  test('should create not found result', () => {
    const processor = new BaseProcessor();
    const card = { Name: 'Lightning Bolt', Quantity: 4 };
    
    const result = processor.createNotFoundResult(card, 'teststore');
    
    expect(result).toBeInstanceOf(CardResult);
    expect(result.name).toBe('Lightning Bolt');
    expect(result.quantity).toBe(4);
    expect(result.source).toBe('teststore');
    expect(result.found).toBe(false);
    expect(result.inStock).toBe(false);
  });

  test('should have delay method', async () => {
    const processor = new BaseProcessor();
    const start = Date.now();
    
    await processor.delay(100);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(95); // Allow some timing variance
  });

  test('delay should resolve after specified time', async () => {
    const processor = new BaseProcessor();
    let resolved = false;
    
    processor.delay(50).then(() => {
      resolved = true;
    });
    
    // Should not be resolved immediately
    expect(resolved).toBe(false);
    
    // Wait for delay to complete
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(resolved).toBe(true);
  });
});