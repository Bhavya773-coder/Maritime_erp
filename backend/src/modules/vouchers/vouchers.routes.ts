import { Router, Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validator';
import {
  getVouchers,
  getMyVouchers,
  getVoucherById,
  createVoucher,
  addReceipts,
  approveVoucher,
  rejectVoucher,
  requestInfo,
  exportData,
  getSummary
} from './vouchers.controller';
import {
  createVoucherSchema,
  addReceiptsSchema,
  rejectVoucherSchema,
  requestInfoSchema,
  approveVoucherSchema,
  getVouchersQuerySchema,
  exportVouchersQuerySchema
} from './vouchers.schema';

const router = Router();

// Middleware to validate UUID parameter for ID path
const validateVoucherId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (id && !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid voucher ID'
    });
  }
  next();
};

// All routes require authentication
router.use(requireAuth);

// 1. GET /api/vouchers/my (Self queue)
router.get('/my', validate(getVouchersQuerySchema), getMyVouchers);

// 2. GET /api/vouchers/export (OWNER, MANAGER, or ACCOUNTS only)
router.get('/export', requireRole([Role.OWNER, Role.MANAGER, Role.ACCOUNTS]), validate(exportVouchersQuerySchema), exportData);

// 3. GET /api/vouchers/summary/dashboard (OWNER or MANAGER only)
router.get('/summary/dashboard', requireRole([Role.OWNER, Role.MANAGER]), getSummary);

// 4. GET /api/vouchers (OWNER or MANAGER only review queue)
router.get('/', requireRole([Role.OWNER, Role.MANAGER]), validate(getVouchersQuerySchema), getVouchers);

// 5. POST /api/vouchers (Any authenticated active user can submit)
router.post('/', validate(createVoucherSchema), createVoucher);

// 6. GET /api/vouchers/:id (Access control implemented dynamically in controller/service)
router.get('/:id', validateVoucherId, getVoucherById);

// 7. POST /api/vouchers/:id/receipts (Access control implemented dynamically in controller/service)
router.post('/:id/receipts', validateVoucherId, validate(addReceiptsSchema), addReceipts);

// 8. PATCH /api/vouchers/:id/approve (OWNER or MANAGER only)
router.patch('/:id/approve', validateVoucherId, requireRole([Role.OWNER, Role.MANAGER]), validate(approveVoucherSchema), approveVoucher);

// 9. PATCH /api/vouchers/:id/reject (OWNER or MANAGER only)
router.patch('/:id/reject', validateVoucherId, requireRole([Role.OWNER, Role.MANAGER]), validate(rejectVoucherSchema), rejectVoucher);

// 10. PATCH /api/vouchers/:id/request-info (OWNER or MANAGER only)
router.patch('/:id/request-info', validateVoucherId, requireRole([Role.OWNER, Role.MANAGER]), validate(requestInfoSchema), requestInfo);

export default router;
