import express from 'express';
import cardController from '../controllers/cardController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Analyze a card to get its properties
router.get('/:cardName/analyze', requireAuth, cardController.analyzeCard);

// Search for alternative cards based on criteria
router.post('/search-alternatives', requireAuth, cardController.searchAlternatives);

export default router;