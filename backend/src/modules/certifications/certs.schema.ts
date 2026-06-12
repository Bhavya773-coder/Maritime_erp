import { z } from 'zod';

const dateSchema = z.string().refine(val => !isNaN(Date.parse(val)), {
  message: 'Invalid date format'
}).transform(val => new Date(val));

export const createCertSchema = z.object({
  body: z.object({
    vesselId: z.string().uuid('Invalid vessel ID').nullable().optional(),
    assetType: z.string().min(1, 'Asset type cannot be empty').max(100, 'Asset type cannot exceed 100 characters').nullable().optional(),
    certType: z.string().min(1, 'Certificate type is required').max(150, 'Certificate type cannot exceed 150 characters'),
    certNumber: z.string().min(1, 'Certificate number is required').max(150, 'Certificate number cannot exceed 150 characters'),
    issuingAuthority: z.string().min(1, 'Issuing authority is required').max(200, 'Issuing authority cannot exceed 200 characters'),
    issueDate: dateSchema,
    expiryDate: dateSchema,
    documentUrl: z.string().url('Invalid document URL').max(1000).nullable().optional().or(z.string().length(0).transform(() => null)),
  }).refine(data => {
    return (data.vesselId !== undefined && data.vesselId !== null) || (data.assetType !== undefined && data.assetType !== null);
  }, {
    message: 'Either vesselId or assetType must be provided.',
    path: ['vesselId']
  }).refine(data => {
    return data.issueDate <= data.expiryDate;
  }, {
    message: 'Issue date must be before or equal to expiry date.',
    path: ['issueDate']
  })
});

export const updateCertSchema = z.object({
  body: z.object({
    vesselId: z.string().uuid('Invalid vessel ID').nullable().optional(),
    assetType: z.string().min(1, 'Asset type cannot be empty').max(100, 'Asset type cannot exceed 100 characters').nullable().optional(),
    certType: z.string().min(1, 'Certificate type cannot be empty').max(150, 'Certificate type cannot exceed 150 characters').optional(),
    certNumber: z.string().min(1, 'Certificate number cannot be empty').max(150, 'Certificate number cannot exceed 150 characters').optional(),
    issuingAuthority: z.string().min(1, 'Issuing authority cannot be empty').max(200, 'Issuing authority cannot exceed 200 characters').optional(),
    issueDate: dateSchema.optional(),
    expiryDate: dateSchema.optional(),
    documentUrl: z.string().url('Invalid document URL').max(1000).nullable().optional().or(z.string().length(0).transform(() => null)),
  })
});

export const getCertsQuerySchema = z.object({
  query: z.object({
    vesselId: z.string().uuid('Invalid vessel ID').optional(),
    assetType: z.string().optional(),
    certType: z.string().optional(),
    status: z.string().optional().transform(val => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['VALID', 'EXPIRING_SOON', 'EXPIRED'].includes(upper)) {
        return upper;
      }
      return undefined;
    }),
    expiringWithinDays: z.string().optional().transform(val => {
      if (!val) return undefined;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
    search: z.string().optional(),
  })
});

export const expiringQuerySchema = z.object({
  query: z.object({
    days: z.string().optional().transform(val => {
      const parsed = parseInt(val || '30', 10);
      return isNaN(parsed) || parsed < 0 ? 30 : parsed;
    }).default('30')
  })
});

export const uploadDocSchema = z.object({
  body: z.object({
    documentUrl: z.string().url('Invalid document URL').max(1000)
  })
});
