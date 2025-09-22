import { Request, Response } from 'express';
import logger from '../config/logger';
import { importDeck as importDeckService } from '../services/importService';

const importDeck = async (req: Request, res: Response) => {
  logger.info('Import request received', { body: req.body, user: (req as any).user });

  try {
    const { importData, name } = req.body;
    const userId = (req as any).user?.id;

    logger.info('Processing import request', { importData: importData?.length, name, userId });

    if (!importData) {
      logger.warn('Missing import data');
      return res.status(400).json({
        error: 'Missing import data field in request body'
      });
    }

    if (!name || !name.trim()) {
      logger.warn('Missing deck name');
      return res.status(400).json({
        error: 'Missing deck name field in request body'
      });
    }

    logger.info('Calling import service...');
    const result = await importDeckService(importData, userId, name.trim());
    logger.info('Import service completed', { result });

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