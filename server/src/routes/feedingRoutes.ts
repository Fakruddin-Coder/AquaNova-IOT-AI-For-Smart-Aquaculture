import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import {
  getFeedingByDevice,
  createFeeding,
  updateFeeding,
  deleteFeeding,
  clearFeedingHistory,
} from '../controllers/feedingController.js';

const router = Router();
router.use(authenticateJWT);

router.get('/:deviceId', getFeedingByDevice);
router.post('/', createFeeding);
router.delete('/:deviceId/history', clearFeedingHistory);
router.put('/:id', updateFeeding);
router.delete('/:id', deleteFeeding);

export default router;
