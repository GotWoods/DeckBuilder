const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const importRoutes = require('../../src/routes/importRoutes');

// Mock the dependencies
jest.mock('../../src/models/deckSchema', () => {
  return jest.fn().mockImplementation(() => ({
    Cards: [],
    Importing: false,
    createdAt: new Date(),
    import: jest.fn(),
    save: jest.fn().mockResolvedValue({ _id: 'mockId' })
  }));
});
jest.mock('../../src/utils/deckQueue');
jest.mock('../../src/config/logger');

const Deck = require('../../src/models/deckSchema');
const deckQueue = require('../../src/utils/deckQueue');

// Create test app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api/import', importRoutes);

describe('API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/import', () => {
    test('should import valid deck data', async () => {
      const mockDeck = {
        _id: 'mockDeckId',
        import: jest.fn(),
        save: jest.fn().mockResolvedValue({ _id: 'mockDeckId' })
      };
      
      const mockJob = { id: 'mockJobId' };
      
      Deck.mockImplementation(() => mockDeck);
      deckQueue.add.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/import')
        .send({ importData: '4 Lightning Bolt\n2 Counterspell' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Deck imported and queued for processing',
        deckId: 'mockDeckId',
        jobId: 'mockJobId'
      });

      expect(mockDeck.import).toHaveBeenCalledWith('4 Lightning Bolt\n2 Counterspell');
      expect(mockDeck.save).toHaveBeenCalled();
      expect(deckQueue.add).toHaveBeenCalledWith(
        'processDeck',
        { deckId: 'mockDeckId' },
        { attempts: 3, backoff: 'exponential', delay: 1000 }
      );
    });

    test('should return 400 when importData is missing', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Missing import data field in request body'
      });
    });

    test('should return 500 when save fails', async () => {
      const mockDeck = {
        import: jest.fn(),
        save: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      
      Deck.mockImplementation(() => mockDeck);

      const response = await request(app)
        .post('/api/import')
        .send({ importData: '4 Lightning Bolt' })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to import deck'
      });
    });
  });
});