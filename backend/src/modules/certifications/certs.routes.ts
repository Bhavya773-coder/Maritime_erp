import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  getCerts,
  getExpiringCerts,
  getCertById,
  createCert,
  updateCert,
  uploadDoc,
  recalculateStatus,
  checkAlerts,
} from './certs.controller';
import {
  createCertSchema,
  updateCertSchema,
  getCertsQuerySchema,
  expiringQuerySchema,
  uploadDocSchema,
} from './certs.schema';

const router = Router();

// Middleware to validate UUID parameter for ID path
const validateCertId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid certificate id',
    });
  }
  next();
};

// All routes require authentication
router.use(requireAuth);

// 1. GET /api/certs/expiring (authenticated users)
router.get('/expiring', validate(expiringQuerySchema), getExpiringCerts);

// 2. PATCH /api/certs/recalculate-status (OWNER only)
router.patch('/recalculate-status', requireRole([Role.OWNER]), recalculateStatus);

// 3. POST /api/certs/check-alerts (OWNER only)
router.post('/check-alerts', requireRole([Role.OWNER]), checkAlerts);

// 4. GET /api/certs (authenticated users)
router.get('/', validate(getCertsQuerySchema), getCerts);

// 5. POST /api/certs (OWNER/MANAGER only)
router.post('/', requireRole([Role.OWNER, Role.MANAGER]), validate(createCertSchema), createCert);

// 6. GET /api/certs/:id (authenticated users)
router.get('/:id', validateCertId, getCertById);

// 7. PATCH /api/certs/:id (OWNER/MANAGER only)
router.patch('/:id', validateCertId, requireRole([Role.OWNER, Role.MANAGER]), validate(updateCertSchema), updateCert);

// 8. POST /api/certs/:id/upload (OWNER/MANAGER only)
router.post('/:id/upload', validateCertId, requireRole([Role.OWNER, Role.MANAGER]), validate(uploadDocSchema), uploadDoc);

export default router;
