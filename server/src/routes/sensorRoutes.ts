import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import {
  createReading,
  getLatestReading,
  getReadingHistory,
} from '../controllers/sensorController.js';

const router = Router();
router.use(authenticateJWT);

router.post('/readings', createReading);
router.get('/:deviceId/latest', getLatestReading);
router.get('/:deviceId/history', getReadingHistory);

export default router;
