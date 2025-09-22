import express from 'express';
import deckController from '../controllers/deckController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

router.get('/', requireAuth, deckController.getAll);
router.get('/:id', requireAuth, deckController.getById);
router.post('/:deckId/card/:cardIndex/purchase', requireAuth, deckController.markCardPurchased);
router.post('/:deckId/card/:cardIndex/select-pricing', requireAuth, deckController.updateSelectedPricing);
router.post('/:deckId/card/:cardIndex/substitute', requireAuth, deckController.substituteCard);
router.post('/:id/refresh', requireAuth, deckController.refreshPricing);
router.post('/:id/reset-import', requireAuth, deckController.resetImportStatus);
router.delete('/:id', requireAuth, deckController.deleteDeck);
export default router;