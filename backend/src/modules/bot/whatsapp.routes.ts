import { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  verifyWebhook,
  receiveWebhook,
  testWebhook,
} from './whatsapp.controller';

const router = Router();

// Webhook endpoints (Public for Meta verification and event updates)
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Protected endpoints (Authenticated OWNER only)
router.use(requireAuth);
router.use(requireRole([Role.OWNER]));

router.post('/test-webhook', testWebhook);

export default router;
