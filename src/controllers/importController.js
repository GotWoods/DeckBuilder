const logger = require('../config/logger');
const importService = require('../services/importService');

const importDeck = async (req, res) => {
  try {
    const { importData } = req.body;
    
    if (!importData) {
      return res.status(400).json({ 
        error: 'Missing import data field in request body' 
      });
    }

    const result = await importService.importDeck(importData);
    
    res.status(200).json({ 
      message: 'Deck imported and queued for processing',
      deckId: result.deckId,
      jobId: result.jobId
    });
  } catch (error) {
    logger.error('Error importing deck:', error);
    res.status(500).json({
      error: 'Failed to import deck'
    });
  }
};

module.exports = {
  importDeck
};