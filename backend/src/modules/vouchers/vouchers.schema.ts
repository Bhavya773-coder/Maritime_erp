import { z } from 'zod';

const dateSchema = z.string().refine(val => !isNaN(Date.parse(val)), {
  message: 'Invalid date format'
}).transform(val => new Date(val));

const expenseCategories = [
  'Fuel',
  'Vehicle Maintenance',
  'Barge Operations',
  'Hotel',
  'Documentation',
  'Customs Fees',
  'Port Charges',
  'Travel',
  'Miscellaneous'
] as const;

export const createVoucherSchema = z.object({
  body: z.object({
    expenseType: z.enum(expenseCategories, {
      errorMap: () => ({ message: 'Invalid expense category' })
    }),
    amount: z.number().positive('Amount must be a positive number'),
    expenseDate: dateSchema.refine(val => {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      return val <= oneYearFromNow;
    }, {
      message: 'Expense date cannot be more than 1 year in the future'
    }),
    vendorName: z.string().min(1, 'Vendor name is required').max(200, 'Vendor name cannot exceed 200 characters'),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
    receiptUrls: z.array(z.string().url('Invalid receipt URL')).min(1, 'At least one receipt URL is required').max(5, 'Maximum of 5 receipt URLs are allowed')
  })
});

export const addReceiptsSchema = z.object({
  body: z.object({
    receiptUrls: z.array(z.string().url('Invalid receipt URL')).min(1, 'At least one receipt URL is required').max(5, 'Maximum of 5 receipt URLs are allowed')
  })
});

export const rejectVoucherSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Reason is required')
  })
});

export const requestInfoSchema = z.object({
  body: z.object({
    note: z.string().min(1, 'Note is required')
  })
});

export const approveVoucherSchema = z.object({
  body: z.object({
    approverNote: z.string().max(1000, 'Note cannot exceed 1000 characters').optional().nullable()
  })
});

export const getVouchersQuerySchema = z.object({
  query: z.object({
    status: z.string().optional().transform(val => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(upper)) {
        return upper;
      }
      return undefined;
    }),
    expenseType: z.string().optional(),
    submittedById: z.string().uuid('Invalid submitter ID').optional(),
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
    dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
    search: z.string().optional()
  })
});

export const exportVouchersQuerySchema = z.object({
  query: z.object({
    status: z.string().optional().transform(val => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'].includes(upper)) {
        return upper;
      }
      return undefined;
    }),
    expenseType: z.string().optional(),
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
    dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined)
  })
});
