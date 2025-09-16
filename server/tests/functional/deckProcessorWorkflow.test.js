const deckQueue = require('../../src/utils/deckQueue');
const { CardResult } = require('../../src/models/cardResult');

// Mock the Deck model since we don't have database access
jest.mock('../../src/models/deckSchema', () => {
  return jest.fn().mockImplementation(() => ({
    _id: 'mockDeckId',
    Cards: [],
    Importing: true,
    save: jest.fn().mockResolvedValue({ _id: 'mockDeckId' }),
    findById: jest.fn().mockResolvedValue({
      _id: 'mockDeckId',
      Cards: [
        { Name: 'Lightning Bolt', Quantity: 1 },
        { Name: 'Counterspell', Quantity: 1 }
      ],
      Importing: true,
      save: jest.fn().mockResolvedValue()
    })
  }));
});

const Deck = require('../../src/models/deckSchema');

describe('Deck Processor Workflow - Functional Tests', () => {
  const TIMEOUT = 60000; // 1 minute timeout

  beforeAll(() => {
    jest.setTimeout(TIMEOUT);
  });

  afterAll(async () => {
    // Clean up any jobs
    await deckQueue.close();
  });

  describe('Background Job Processing', () => {
    test('should process deck job with real API calls', async () => {
      console.log('Starting deck processor workflow test...');

      // Create mock deck with common cards
      const mockDeck = {
        _id: 'test-deck-id',
        Cards: [
          { Name: 'Lightning Bolt', Quantity: 1 },
          { Name: 'Counterspell', Quantity: 1 }
        ],
        Importing: true,
        save: jest.fn().mockResolvedValue()
      };

      // Mock Deck.findById to return our test deck
      Deck.findById = jest.fn().mockResolvedValue(mockDeck);

      // Load the deck processor worker
      require('../../src/workers/deckProcessor');
      console.log('Deck processor worker loaded');

      // Add job to queue
      const job = await deckQueue.add('processDeck', { 
        deckId: 'test-deck-id' 
      }, {
        attempts: 1,
        backoff: 'exponential',
        delay: 100
      });

      console.log(`Job ${job.id} added to queue`);

      // Wait for job to complete
      let attempts = 0;
      const maxAttempts = 30; // 1 minute with 2-second intervals
      let completedJob;

      while (attempts < maxAttempts) {
        completedJob = await deckQueue.getJob(job.id);
        
        if (completedJob && completedJob.finishedOn) {
          console.log(`Job completed after ${attempts + 1} attempts (${(attempts + 1) * 2} seconds)`);
          break;
        } else if (completedJob && completedJob.failedReason) {
          throw new Error(`Job failed: ${completedJob.failedReason}`);
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (attempts >= maxAttempts) {
        throw new Error('Job did not complete within timeout period');
      }

      // Verify job completed successfully
      expect(completedJob).toBeDefined();
      expect(completedJob.finishedOn).toBeDefined();
      expect(completedJob.returnvalue).toBeDefined();
      expect(completedJob.returnvalue.success).toBe(true);
      expect(completedJob.returnvalue.cardsProcessed).toBe(2);

      console.log('Job result:', completedJob.returnvalue);

      // Verify deck.save was called (simulating database updates)
      expect(mockDeck.save).toHaveBeenCalled();

      // Check that cards would have been updated with pricing
      // (The save calls would have been made with updated card data)
      const saveCalls = mockDeck.save.mock.calls;
      expect(saveCalls.length).toBeGreaterThan(0);

      console.log(`✅ Workflow test completed successfully!`);
      console.log(`Processed ${completedJob.returnvalue.cardsProcessed} cards in ${completedJob.returnvalue.batchesProcessed} batches`);
      console.log(`Results: ${JSON.stringify(completedJob.returnvalue.processorResults)}`);

    }, TIMEOUT);

    test('should handle job with non-existent deck', async () => {
      console.log('Testing job with non-existent deck...');

      // Mock Deck.findById to return null
      Deck.findById = jest.fn().mockResolvedValue(null);

      // Add job for non-existent deck
      const job = await deckQueue.add('processDeck', { 
        deckId: 'non-existent-deck-id' 
      }, {
        attempts: 1,
        delay: 100
      });

      // Wait for job to fail
      let attempts = 0;
      const maxAttempts = 15;
      let completedJob;

      while (attempts < maxAttempts) {
        completedJob = await deckQueue.getJob(job.id);
        
        if (completedJob && (completedJob.finishedOn || completedJob.failedReason)) {
          break;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Job should have failed due to deck not found
      expect(completedJob).toBeDefined();
      expect(completedJob.failedReason).toBeDefined();
      expect(completedJob.failedReason).toContain('not found');

      console.log(`✅ Non-existent deck handling test completed successfully!`);
      console.log(`Job correctly failed: ${completedJob.failedReason}`);

    }, TIMEOUT);
  });
});