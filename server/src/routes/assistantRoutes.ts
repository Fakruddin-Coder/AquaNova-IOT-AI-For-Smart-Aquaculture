import { Router } from 'express';
import { chatWithAssistant } from '../controllers/assistantController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.post('/chat', authenticateJWT, chatWithAssistant);

export default router;
