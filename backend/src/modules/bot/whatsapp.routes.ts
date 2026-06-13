import { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  verifyWebhook,
  receiveWebhook,
  testWebhook,
  createContact,
  getContacts,
} from './whatsapp.controller';

const router = Router();

// Webhook endpoints (Public for Meta verification and event updates)
router.get('/whatsapp/webhook', verifyWebhook);
router.post('/whatsapp/webhook', receiveWebhook);

// Protected endpoints (Authenticated OWNER only)
router.use(requireAuth);
router.use(requireRole([Role.OWNER]));

router.post('/whatsapp/test-webhook', testWebhook);
router.post('/contacts', createContact);
router.get('/contacts', getContacts);

export default router;
