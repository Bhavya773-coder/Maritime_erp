import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  getVessels,
  getVesselDetails,
  createVessel,
  updateVesselLocation,
  getLocationHistory,
  getExportSnapshot,
} from './vessels.controller';
import {
  createVesselSchema,
  updateLocationSchema,
  getVesselsQuerySchema,
  getHistoryQuerySchema,
} from './vessels.schema';

const router = Router();

// Middleware to validate UUID vessel ID params
const validateVesselId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid vessel id',
    });
  }
  next();
};

// Require authentication for all vessel routes
router.use(requireAuth);

// Export-ready snapshot MUST be registered before /:id to avoid route collision
router.get('/export/snapshot', getExportSnapshot);

// Standard vessel operations
router.get('/', validate(getVesselsQuerySchema), getVessels);
router.post('/', requireRole([Role.OWNER]), validate(createVesselSchema), createVessel);

router.get('/:id', validateVesselId, getVesselDetails);
router.patch('/:id/location', validateVesselId, requireRole([Role.OWNER, Role.FLEET_MANAGER]), validate(updateLocationSchema), updateVesselLocation);
router.get('/:id/history', validateVesselId, validate(getHistoryQuerySchema), getLocationHistory);

export default router;
