import express from 'express';
import deckController from '../controllers/deckController';

const router = express.Router();

router.get('/', deckController.getAll);

export default router;