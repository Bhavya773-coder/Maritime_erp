import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  testCommand,
  getMessages,
  getReminders,
  pauseReminder,
} from './bot.controller';
import { testCommandSchema } from './bot.schema';

const router = Router();

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

// Require authentication for all bot routes
router.use(requireAuth);

router.post('/test-command', validate(testCommandSchema), testCommand);
router.get('/messages', requireRole([Role.OWNER]), getMessages);
router.get('/reminders', requireRole([Role.OWNER, Role.MANAGER]), getReminders);
router.patch('/reminders/:id/pause', validateReminderId, requireRole([Role.OWNER, Role.MANAGER]), pauseReminder);

export default router;
