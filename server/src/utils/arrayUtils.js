/**
 * Utility functions for array manipulation
 */

/**
 * Split an array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array[]} Array of chunks
 */
const chunk = (array, size) => {
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Create batches with additional metadata
 * @param {Array} array - Array to batch
 * @param {number} batchSize - Size of each batch
 * @returns {Array} Array of batch objects with items and metadata
 */
const createBatches = (array, batchSize) => {
  const chunks = chunk(array, batchSize);
  return chunks.map((items, index) => ({
    batchNumber: index + 1,
    totalBatches: chunks.length,
    items: items,
    size: items.length
  }));
};

module.exports = {
  chunk,
  createBatches
};