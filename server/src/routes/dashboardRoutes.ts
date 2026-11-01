import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { getDashboardData } from '../controllers/dashboardController.js';

const router = Router();
router.use(authenticateJWT);

router.get('/:deviceId', getDashboardData);

export default router;
