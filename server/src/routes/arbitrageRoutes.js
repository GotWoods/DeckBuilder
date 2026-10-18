import express from 'express';
import arbitrageController from '../controllers/arbitrageController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

router.post('/scan', requireAuth, arbitrageController.startScan);
router.get('/scan/latest', requireAuth, arbitrageController.getLatestScan);
router.get('/opportunities', requireAuth, arbitrageController.getOpportunities);
export default router;
