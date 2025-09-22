import express from 'express';
import deckController from '../controllers/deckController';

const router = express.Router();

router.get('/', deckController.getAll);
router.get('/:id', deckController.getById);
router.post('/:deckId/card/:cardIndex/purchase', deckController.markCardPurchased);
router.post('/:deckId/card/:cardIndex/select-pricing', deckController.updateSelectedPricing);
router.post('/:deckId/card/:cardIndex/substitute', deckController.substituteCard);
router.post('/:id/refresh', deckController.refreshPricing);
router.post('/:id/reset-import', deckController.resetImportStatus);
router.delete('/:id', deckController.deleteDeck);
export default router;