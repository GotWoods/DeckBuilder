const { chunk, createBatches } = require('../../src/utils/arrayUtils');

describe('arrayUtils', () => {
  describe('chunk', () => {
    test('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = chunk(array, 3);
      
      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10]
      ]);
    });

    test('should handle exact division', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const result = chunk(array, 2);
      
      expect(result).toEqual([
        [1, 2],
        [3, 4],
        [5, 6]
      ]);
    });

    test('should handle empty array', () => {
      const result = chunk([], 3);
      expect(result).toEqual([]);
    });

    test('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const result = chunk(array, 5);
      
      expect(result).toEqual([[1, 2, 3]]);
    });

    test('should throw error for invalid chunk size', () => {
      expect(() => chunk([1, 2, 3], 0)).toThrow('Chunk size must be greater than 0');
      expect(() => chunk([1, 2, 3], -1)).toThrow('Chunk size must be greater than 0');
    });
  });

  describe('createBatches', () => {
    test('should create batches with metadata', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const result = createBatches(array, 3);
      
      expect(result).toEqual([
        {
          batchNumber: 1,
          totalBatches: 3,
          items: [1, 2, 3],
          size: 3
        },
        {
          batchNumber: 2,
          totalBatches: 3,
          items: [4, 5, 6],
          size: 3
        },
        {
          batchNumber: 3,
          totalBatches: 3,
          items: [7],
          size: 1
        }
      ]);
    });

    test('should handle single batch', () => {
      const array = [1, 2];
      const result = createBatches(array, 5);
      
      expect(result).toEqual([
        {
          batchNumber: 1,
          totalBatches: 1,
          items: [1, 2],
          size: 2
        }
      ]);
    });

    test('should handle empty array', () => {
      const result = createBatches([], 3);
      expect(result).toEqual([]);
    });
  });
});