const express = require('express');
const Deck = require('../data/deckSchema');
const deckQueue = require('../queues/deckQueue');

const router = express.Router();

router.post('/import', async (req, res) => {
  try {
    const { importData } = req.body;
    
    if (!importData) {
      return res.status(400).json({ 
        error: 'Missing import data field in request body' 
      });
    }

    const deck = new Deck();
    deck.import(importData);
    const savedDeck = await deck.save();

    console.log('Saved deck to database:', savedDeck._id);
    
    // Add job to processing queue
    const job = await deckQueue.add('processDeck', { 
      deckId: savedDeck._id 
    }, {
      attempts: 3,
      backoff: 'exponential',
      delay: 1000
    });
    
    console.log(`Added deck processing job: ${job.id}`);
    
    res.status(200).json({ 
      message: 'Deck imported and queued for processing',
      deckId: savedDeck._id,
      jobId: job.id
    });
  } catch (error) {
    console.error('Error saving deck:', error);
    res.status(500).json({
      error: 'Failed to save deck to database'
    });
  }
});

module.exports = router;