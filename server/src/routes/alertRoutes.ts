import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import {
  getAlertsByDevice,
  createAlert,
  resolveAlert,
} from '../controllers/alertController.js';

const router = Router();
router.use(authenticateJWT);

router.get('/:deviceId', getAlertsByDevice);
router.post('/', createAlert);
router.put('/:id/resolve', resolveAlert);

export default router;
