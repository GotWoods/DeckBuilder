import express from 'express';
import cardController from '../controllers/cardController';

const router = express.Router();

// Analyze a card to get its properties
router.get('/:cardName/analyze', cardController.analyzeCard);

// Search for alternative cards based on criteria
router.post('/search-alternatives', cardController.searchAlternatives);

export default router;