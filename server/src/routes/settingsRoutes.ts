import { Router } from 'express';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getSystemInfo,
} from '../controllers/settingsController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.get('/notifications/preferences', authenticateJWT, getNotificationPreferences);
router.put('/notifications/preferences', authenticateJWT, updateNotificationPreferences);
router.get('/system/info', authenticateJWT, getSystemInfo);

export default router;
