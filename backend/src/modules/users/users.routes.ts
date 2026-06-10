import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getActiveUsers } from './users.controller';
import { Role } from '@prisma/client';

const router = Router();

router.get('/active', requireAuth, requireRole([Role.OWNER, Role.MANAGER]), getActiveUsers);

export default router;
