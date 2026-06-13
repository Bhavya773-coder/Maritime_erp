import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  testCommand,
  getMessages,
  getReminders,
  pauseReminder,
  processDueReminders,
} from './bot.controller';
import { testCommandSchema } from './bot.schema';
import whatsappRoutes from './whatsapp.routes';
import { createContact, getContacts } from './whatsapp.controller';

const router = Router();

// Mount WhatsApp webhook and test subroutes (public/protected segregation handled internally)
router.use('/whatsapp', whatsappRoutes);

// Middleware to validate UUID reminder ID params
const validateReminderId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid reminder id',
    });
  }
  next();
};

// Require authentication for all other bot routes
router.use(requireAuth);

router.post('/test-command', validate(testCommandSchema), testCommand);
router.get('/messages', requireRole([Role.OWNER]), getMessages);
router.get('/reminders', requireRole([Role.OWNER, Role.MANAGER]), getReminders);
router.patch('/reminders/:id/pause', validateReminderId, requireRole([Role.OWNER, Role.MANAGER]), pauseReminder);
router.post('/reminders/process-due', requireRole([Role.OWNER]), processDueReminders);

// Contacts management (OWNER only)
router.post('/contacts', requireRole([Role.OWNER]), createContact);
router.get('/contacts', requireRole([Role.OWNER]), getContacts);

export default router;
