import express from 'express';
import deckController from '../controllers/deckController';

const router = express.Router();

router.get('/', deckController.getAll);
router.get('/test', (req, res) => {
  res.json({ message: 'Test route works', success: true });
});
router.get('/:id', deckController.getById);

export default router;