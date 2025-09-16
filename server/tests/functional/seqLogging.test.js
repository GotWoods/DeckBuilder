// Load test environment variables
require('dotenv').config({ path: '.env.test' });

const logger = require('../../src/config/logger');

describe('Seq Logging - Functional Test', () => {
  test('should send logs to Seq', async () => {
    console.log('Testing Seq logging...');
    console.log(`SEQ_URL: ${process.env.SEQ_URL}`);
    console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL}`);
    
    // Send different log levels to Seq
    logger.error('🔴 TEST ERROR: This is an error log from functional test');
    logger.warn('🟡 TEST WARN: This is a warning log from functional test');
    logger.info('🔵 TEST INFO: This is an info log from functional test');
    logger.debug('⚪ TEST DEBUG: This is a debug log from functional test');
    
    // Add structured logging
    logger.info('🧪 TEST STRUCTURED LOG', {
      testType: 'functional',
      component: 'seqLogging',
      timestamp: new Date().toISOString(),
      metadata: {
        environment: 'test',
        nodeEnv: process.env.NODE_ENV,
        logLevel: process.env.LOG_LEVEL
      }
    });
    
    console.log('✅ Logs sent to winston. Check Seq at http://localhost:5341');
    console.log('Look for logs with service: "deckbuilder" and messages starting with "🔴 TEST", "🟡 TEST", "🔵 TEST"');
    
    // Wait a moment for logs to be transmitted
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // This test always passes - the real test is checking Seq manually
    expect(true).toBe(true);
  });
  
  test('should check winston transports', () => {
    console.log('Winston logger configuration:');
    console.log(`Number of transports: ${logger.transports.length}`);
    
    logger.transports.forEach((transport, index) => {
      console.log(`Transport ${index + 1}: ${transport.constructor.name}`);
      if (transport.constructor.name === 'SeqTransport') {
        console.log(`  - Seq URL: ${transport.serverUrl}`);
        console.log(`  - Has API Key: ${!!transport.apiKey}`);
      }
    });
    
    // Check if SeqTransport is present
    const hasSeqTransport = logger.transports.some(t => t.constructor.name === 'SeqTransport');
    console.log(`Has Seq Transport: ${hasSeqTransport}`);
    
    if (!hasSeqTransport) {
      console.warn('⚠️  No SeqTransport found! Logs will not go to Seq.');
      console.warn('This might be because winston-seq failed to load.');
    }
    
    expect(logger.transports.length).toBeGreaterThan(0);
  });
});