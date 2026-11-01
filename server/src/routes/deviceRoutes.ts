import { Router } from 'express';
import {
  createDevice,
  getDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
} from '../controllers/deviceController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.use(authenticateJWT);

router.post('/', createDevice);
router.get('/', getDevices);
router.get('/:deviceId', getDeviceById);
router.put('/:deviceId', updateDevice);
router.delete('/:deviceId', deleteDevice);

export default router;
