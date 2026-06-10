import { z } from 'zod';
import { VesselType, VesselStatus } from '@prisma/client';

export const createVesselSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150, 'Name cannot exceed 150 characters'),
    registrationNo: z.string().min(1, 'Registration number is required').max(100, 'Registration number cannot exceed 100 characters'),
    type: z.nativeEnum(VesselType, {
      required_error: 'Vessel type is required (BARGE or TUG)',
    }),
    currentLocation: z.string().min(1, 'Current location is required').max(255, 'Current location cannot exceed 255 characters'),
    latitude: z.union([z.number(), z.string()]).transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num < -90 || num > 90) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Latitude must be a valid number between -90 and 90',
        });
        return z.NEVER;
      }
      return num;
    }),
    longitude: z.union([z.number(), z.string()]).transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num < -180 || num > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Longitude must be a valid number between -180 and 180',
        });
        return z.NEVER;
      }
      return num;
    }),
    status: z.nativeEnum(VesselStatus).default(VesselStatus.IN_PORT),
  }),
});

export const updateLocationSchema = z.object({
  body: z.object({
    currentLocation: z.string().min(1, 'Current location is required').max(255, 'Current location cannot exceed 255 characters'),
    latitude: z.union([z.number(), z.string()]).transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num < -90 || num > 90) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Latitude must be a valid number between -90 and 90',
        });
        return z.NEVER;
      }
      return num;
    }),
    longitude: z.union([z.number(), z.string()]).transform((val, ctx) => {
      const num = Number(val);
      if (isNaN(num) || num < -180 || num > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Longitude must be a valid number between -180 and 180',
        });
        return z.NEVER;
      }
      return num;
    }),
    status: z.nativeEnum(VesselStatus, {
      required_error: 'Status is required',
    }),
  }),
});

export const getVesselsQuerySchema = z.object({
  query: z.object({
    type: z.string().optional().transform((val, ctx) => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (upper === 'BARGE' || upper === 'TUG') {
        return upper as VesselType;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid vessel type. Expected: BARGE or TUG',
      });
      return z.NEVER;
    }),
    status: z.string().optional().transform((val, ctx) => {
      if (!val) return undefined;
      const upper = val.toUpperCase();
      if (['ACTIVE', 'IN_PORT', 'MAINTENANCE', 'NON_COMPLIANT'].includes(upper)) {
        return upper as VesselStatus;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid vessel status.',
      });
      return z.NEVER;
    }),
    search: z.string().optional(),
  }),
});

export const getHistoryQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => {
      const parsed = parseInt(val || '1', 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }).default('1'),
    limit: z.string().optional().transform((val) => {
      const parsed = parseInt(val || '20', 10);
      return isNaN(parsed) || parsed < 1 ? 20 : parsed;
    }).default('20'),
  }),
});
