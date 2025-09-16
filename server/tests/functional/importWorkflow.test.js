// Load test environment variables
require('dotenv').config({ path: '.env.test' });

const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const importRoutes = require('../../src/routes/importRoutes');
const deckQueue = require('../../src/utils/deckQueue');
const Deck = require('../../src/models/deckSchema');

// Create test app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/import', importRoutes);

describe('Import Workflow - End-to-End Functional Tests', () => {
  const TIMEOUT = 120000; // 2 minutes for full processing
  let testDeckIds = [];

  beforeAll(async () => {
    // Connect to test database using environment variables
    if (mongoose.connection.readyState === 0) {
      try {
        const testDbUri = process.env.MONGODB_TEST_URI || 
                         process.env.MONGODB_URI?.replace('/deckbuilder', '/deckbuilder-test') ||
                         'mongodb://localhost:27017/deckbuilder-test';
        
        await mongoose.connect(testDbUri);
        console.log('Connected to test database');
      } catch (error) {
        console.error('Failed to connect to test database:', error.message);
        console.log('Set MONGODB_TEST_URI environment variable or ensure MONGODB_URI is set');
        throw error;
      }
    }
    
    // Import and start the deck processor worker
    require('../../src/workers/deckProcessor');
    console.log('Deck processor worker loaded for functional testing');
    
    jest.setTimeout(TIMEOUT);
  });

  afterAll(async () => {
    // Clean up test data
    if (testDeckIds.length > 0) {
      await Deck.deleteMany({ _id: { $in: testDeckIds } });
    }
    
    // Close queue connection
    await deckQueue.close();
    
    // Close database connection
    await mongoose.connection.close();
  });

  describe('Complete Import and Processing Workflow', () => {
    test('should import deck, queue job, and process with real APIs', async () => {
      console.log('Starting end-to-end import test...');
      
      // Step 1: Import deck via API
      const importData = '1 Lightning Bolt\n1 Counterspell';
      const response = await request(app)
        .post('/api/import')
        .send({ importData })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Deck imported and queued for processing');
      expect(response.body).toHaveProperty('deckId');
      expect(response.body).toHaveProperty('jobId');

      const { deckId, jobId } = response.body;
      testDeckIds.push(deckId);

      console.log(`Import successful - Deck ID: ${deckId}, Job ID: ${jobId}`);

      // Step 2: Verify deck was created in database
      let deck = await Deck.findById(deckId);
      expect(deck).toBeDefined();
      expect(deck.Cards).toHaveLength(2);
      expect(deck.Cards[0].Name).toBe('Lightning Bolt');
      expect(deck.Cards[1].Name).toBe('Counterspell');
      expect(deck.Importing).toBe(true);
      // Pricing might already be initialized by the import process
      if (deck.Cards[0].pricing) {
        console.log('Deck cards already have pricing structure initialized');
      } else {
        console.log('Deck cards do not have pricing yet');
      }

      console.log('Deck created in database successfully');

      // Step 3: Wait for job to complete (with polling)
      console.log('Waiting for background processing to complete...');
      let job;
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes with 2-second intervals
      
      while (attempts < maxAttempts) {
        try {
          job = await deckQueue.getJob(jobId);
          
          if (!job) {
            console.log(`Attempt ${attempts + 1}: Job not found yet`);
          } else if (job.finishedOn) {
            console.log(`Job completed after ${attempts + 1} attempts (${(attempts + 1) * 2} seconds)`);
            break;
          } else if (job.failedReason) {
            throw new Error(`Job failed: ${job.failedReason}`);
          } else {
            console.log(`Attempt ${attempts + 1}: Job still processing...`);
          }
        } catch (error) {
          console.log(`Attempt ${attempts + 1}: Error checking job status - ${error.message}`);
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }

      if (attempts >= maxAttempts) {
        throw new Error('Job did not complete within timeout period');
      }

      // Step 4: Verify job completed successfully
      expect(job).toBeDefined();
      expect(job.finishedOn).toBeDefined();
      expect(job.returnvalue).toBeDefined();
      expect(job.returnvalue.success).toBe(true);
      expect(job.returnvalue.cardsProcessed).toBe(2);

      console.log('Job completed successfully:', job.returnvalue);

      // Step 5: Verify deck was processed in database
      deck = await Deck.findById(deckId);
      expect(deck).toBeDefined();
      expect(deck.Importing).toBe(false); // Should be finished importing
      expect(deck.Cards).toHaveLength(2);

      // Step 6: Verify cards have pricing data
      const lightningBolt = deck.Cards.find(c => c.Name === 'Lightning Bolt');
      const counterspell = deck.Cards.find(c => c.Name === 'Counterspell');

      expect(lightningBolt).toBeDefined();
      expect(lightningBolt.pricing).toBeDefined();
      expect(lightningBolt.pricing.results).toBeInstanceOf(Array);
      expect(lightningBolt.pricing.results.length).toBeGreaterThan(0);
      expect(lightningBolt.pricing.processedAt).toBeDefined();

      expect(counterspell).toBeDefined();
      expect(counterspell.pricing).toBeDefined();
      expect(counterspell.pricing.results).toBeInstanceOf(Array);
      expect(counterspell.pricing.results.length).toBeGreaterThan(0);
      expect(counterspell.pricing.processedAt).toBeDefined();

      // Step 7: Verify results from both processors
      const lightningResults = lightningBolt.pricing.results;
      const counterspellResults = counterspell.pricing.results;

      // Should have results from both processors
      const f2fResults = lightningResults.filter(r => r.source === 'facetoface');
      const tapsResults = lightningResults.filter(r => r.source === 'taps');
      
      expect(f2fResults).toHaveLength(1);
      expect(tapsResults).toHaveLength(1);

      // Log the actual results
      console.log('\n=== PROCESSING RESULTS ===');
      console.log('Lightning Bolt:');
      lightningResults.forEach(result => {
        if (result.found) {
          console.log(`  ${result.source}: $${(result.price / 100).toFixed(2)} - ${result.set || 'Unknown Set'} - In Stock: ${result.inStock}`);
        } else {
          console.log(`  ${result.source}: Not found`);
        }
      });
      
      console.log('Counterspell:');
      counterspellResults.forEach(result => {
        if (result.found) {
          console.log(`  ${result.source}: $${(result.price / 100).toFixed(2)} - ${result.set || 'Unknown Set'} - In Stock: ${result.inStock}`);
        } else {
          console.log(`  ${result.source}: Not found`);
        }
      });

      // Step 8: Verify at least some results were found
      const totalFound = [...lightningResults, ...counterspellResults].filter(r => r.found).length;
      expect(totalFound).toBeGreaterThan(0); // At least one result should be found

      console.log(`\n✅ End-to-end test completed successfully! Found pricing for ${totalFound}/4 processor-card combinations.`);
      
    }, TIMEOUT);

    test('should handle deck with non-existent cards', async () => {
      console.log('Testing import with non-existent card...');
      
      const importData = '1 WYWEASDSG\n1 Lightning Bolt';
      const response = await request(app)
        .post('/api/import')
        .send({ importData })
        .expect(200);

      const { deckId, jobId } = response.body;
      testDeckIds.push(deckId);

      // Wait for processing
      let job;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        job = await deckQueue.getJob(jobId);
        if (job && job.finishedOn) break;
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      expect(job.returnvalue.success).toBe(true);

      // Verify results
      const deck = await Deck.findById(deckId);
      const fakeCard = deck.Cards.find(c => c.Name === 'WYWEASDSG');
      const realCard = deck.Cards.find(c => c.Name === 'Lightning Bolt');

      // Fake card should have "not found" results
      expect(fakeCard.pricing.results.every(r => !r.found || r.price === null)).toBe(true);
      
      // Real card should have at least one found result
      expect(realCard.pricing.results.some(r => r.found)).toBe(true);

      console.log('✅ Non-existent card handling test completed successfully!');
      
    }, TIMEOUT);
  });
});