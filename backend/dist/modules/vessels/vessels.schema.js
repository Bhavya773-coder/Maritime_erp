"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoryQuerySchema = exports.getVesselsQuerySchema = exports.updateLocationSchema = exports.createVesselSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createVesselSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required').max(150, 'Name cannot exceed 150 characters'),
        registrationNo: zod_1.z.string().min(1, 'Registration number is required').max(100, 'Registration number cannot exceed 100 characters'),
        type: zod_1.z.nativeEnum(client_1.VesselType, {
            required_error: 'Vessel type is required (BARGE or TUG)',
        }),
        currentLocation: zod_1.z.string().min(1, 'Current location is required').max(255, 'Current location cannot exceed 255 characters'),
        latitude: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((val, ctx) => {
            const num = Number(val);
            if (isNaN(num) || num < -90 || num > 90) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Latitude must be a valid number between -90 and 90',
                });
                return zod_1.z.NEVER;
            }
            return num;
        }),
        longitude: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((val, ctx) => {
            const num = Number(val);
            if (isNaN(num) || num < -180 || num > 180) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Longitude must be a valid number between -180 and 180',
                });
                return zod_1.z.NEVER;
            }
            return num;
        }),
        status: zod_1.z.nativeEnum(client_1.VesselStatus).default(client_1.VesselStatus.IN_PORT),
    }),
});
exports.updateLocationSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentLocation: zod_1.z.string().min(1, 'Current location is required').max(255, 'Current location cannot exceed 255 characters'),
        latitude: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((val, ctx) => {
            const num = Number(val);
            if (isNaN(num) || num < -90 || num > 90) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Latitude must be a valid number between -90 and 90',
                });
                return zod_1.z.NEVER;
            }
            return num;
        }),
        longitude: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).transform((val, ctx) => {
            const num = Number(val);
            if (isNaN(num) || num < -180 || num > 180) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: 'Longitude must be a valid number between -180 and 180',
                });
                return zod_1.z.NEVER;
            }
            return num;
        }),
        status: zod_1.z.nativeEnum(client_1.VesselStatus, {
            required_error: 'Status is required',
        }),
    }),
});
exports.getVesselsQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        type: zod_1.z.string().optional().transform((val, ctx) => {
            if (!val)
                return undefined;
            const upper = val.toUpperCase();
            if (upper === 'BARGE' || upper === 'TUG') {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid vessel type. Expected: BARGE or TUG',
            });
            return zod_1.z.NEVER;
        }),
        status: zod_1.z.string().optional().transform((val, ctx) => {
            if (!val)
                return undefined;
            const upper = val.toUpperCase();
            if (['ACTIVE', 'IN_PORT', 'MAINTENANCE', 'NON_COMPLIANT'].includes(upper)) {
                return upper;
            }
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: 'Invalid vessel status.',
            });
            return zod_1.z.NEVER;
        }),
        search: zod_1.z.string().optional(),
    }),
});
exports.getHistoryQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().transform((val) => {
            const parsed = parseInt(val || '1', 10);
            return isNaN(parsed) || parsed < 1 ? 1 : parsed;
        }).default('1'),
        limit: zod_1.z.string().optional().transform((val) => {
            const parsed = parseInt(val || '20', 10);
            return isNaN(parsed) || parsed < 1 ? 20 : parsed;
        }).default('20'),
    }),
});
