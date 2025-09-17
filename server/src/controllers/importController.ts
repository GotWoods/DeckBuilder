import { Request, Response } from 'express';
import logger from '../config/logger';
import { importDeck as importDeckService } from '../services/importService';

const importDeck = async (req: Request, res: Response) => {
  try {
    const { importData } = req.body;
    const userId = (req as any).user?.id;

    if (!importData) {
      return res.status(400).json({
        error: 'Missing import data field in request body'
      });
    }

    const result = await importDeckService(importData, userId);

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

export {
  importDeck
};