const ProcessorRegistry = require('../../src/utils/processorRegistry');
const CardResult = require('../../src/models/cardResult');

// Mock the processors
jest.mock('../../src/workers/faceToFaceProcessor', () => {
  return jest.fn().mockImplementation(() => ({
    source: 'facetoface',
    processCards: jest.fn()
  }));
});

jest.mock('../../src/workers/tapsProcessor', () => {
  return jest.fn().mockImplementation(() => ({
    source: 'taps',
    processCards: jest.fn()
  }));
});

describe('ProcessorRegistry', () => {
  let registry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ProcessorRegistry();
  });

  test('should initialize with default processors', () => {
    expect(registry.getProcessorCount()).toBe(2);
    expect(registry.getProcessors().map(p => p.source)).toEqual(['facetoface', 'taps']);
  });


  test('should return processors array', () => {
    const processors = registry.getProcessors();
    expect(processors).toBe(registry.processors); // Should be the same reference
    expect(processors).toHaveLength(2);
  });
});