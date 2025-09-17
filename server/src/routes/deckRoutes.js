import express from 'express';
import deckController from '../controllers/deckController';

const router = express.Router();

router.get('/', deckController.getAll);
router.get('/:id', deckController.getById);
router.post('/:id/refresh', deckController.refreshPricing);
export default router;