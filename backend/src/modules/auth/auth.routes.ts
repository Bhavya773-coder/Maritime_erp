import { Router } from 'express';
import { login, logout, me } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import { loginSchema } from './auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

export default router;
