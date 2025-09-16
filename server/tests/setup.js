// Test setup file
// This runs before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock console methods to reduce test output noise
const originalConsoleError = console.error;
console.error = (...args) => {
  // Only log errors that aren't expected test errors
  if (!args[0]?.includes?.('Error sending to Seq')) {
    originalConsoleError(...args);
  }
};

// Global test timeout
jest.setTimeout(10000);