"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VesselsService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Helper error class in case AppError isn't exported globally or structure is different
// Let's import AppError from central errors or middleware if available
const error_1 = require("../../middleware/error");
class VesselsService {
    /**
     * List all visible vessels matching query criteria
     */
    static async getVessels(filters) {
        const whereClause = { deletedAt: null };
        if (filters.type) {
            whereClause.type = filters.type;
        }
        if (filters.status) {
            whereClause.status = filters.status;
        }
        if (filters.search) {
            const searchLower = filters.search.trim();
            whereClause.OR = [
                { name: { contains: searchLower, mode: 'insensitive' } },
                { registrationNo: { contains: searchLower, mode: 'insensitive' } },
            ];
        }
        const vessels = await prisma.vessel.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                registrationNo: true,
                type: true,
                currentLocation: true,
                latitude: true,
                longitude: true,
                status: true,
                updatedAt: true,
                updatedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return vessels;
    }
    /**
     * Fetch vessel detail and recent location history
     */
    static async getVesselById(id) {
        const vessel = await prisma.vessel.findFirst({
            where: { id, deletedAt: null },
            include: {
                updatedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                locationHistory: {
                    orderBy: { updatedAt: 'desc' },
                    take: 10,
                    include: {
                        updatedBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });
        if (!vessel) {
            throw new error_1.AppError('Vessel not found.', 404);
        }
        return vessel;
    }
    /**
     * Create new vessel with initial history log (OWNER only)
     */
    static async createVessel(payload, creatorId) {
        // Enforce uniqueness of registrationNo
        const existing = await prisma.vessel.findFirst({
            where: { registrationNo: payload.registrationNo },
        });
        if (existing) {
            throw new error_1.AppError('A vessel with this registration number already exists.', 400);
        }
        // Retrieve creator details for audit log
        const creator = await prisma.user.findUnique({
            where: { id: creatorId },
        });
        if (!creator) {
            throw new error_1.AppError('Creator user not found.', 404);
        }
        // Execute in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create vessel
            const vessel = await tx.vessel.create({
                data: {
                    name: payload.name,
                    registrationNo: payload.registrationNo,
                    type: payload.type,
                    currentLocation: payload.currentLocation,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    status: payload.status || client_1.VesselStatus.IN_PORT,
                    updatedById: creatorId,
                },
            });
            // 2. Create initial location history record
            await tx.vesselLocationHistory.create({
                data: {
                    vesselId: vessel.id,
                    location: payload.currentLocation,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    updatedById: creatorId,
                },
            });
            // 3. Log to AuditLog
            await tx.auditLog.create({
                data: {
                    userId: creatorId,
                    action: 'VESSEL_CREATED',
                    details: `Vessel "${payload.name}" (${payload.type}) created with registration number ${payload.registrationNo} by ${creator.name}.`,
                },
            });
            return vessel;
        });
        return result;
    }
    /**
     * Update location & status of a vessel (OWNER or FLEET_MANAGER only)
     */
    static async updateVesselLocation(id, payload, user) {
        const vessel = await prisma.vessel.findFirst({
            where: { id, deletedAt: null },
        });
        if (!vessel) {
            throw new error_1.AppError('Vessel not found.', 404);
        }
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update vessel state
            const updatedVessel = await tx.vessel.update({
                where: { id },
                data: {
                    currentLocation: payload.currentLocation,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    status: payload.status,
                    updatedById: user.id,
                },
                include: {
                    updatedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            // 2. Insert new location history entry
            const historyEntry = await tx.vesselLocationHistory.create({
                data: {
                    vesselId: id,
                    location: payload.currentLocation,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    updatedById: user.id,
                },
                include: {
                    updatedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            // 3. Write to AuditLog
            await tx.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'VESSEL_LOCATION_UPDATED',
                    details: `Vessel "${vessel.name}" location updated to "${payload.currentLocation}" (lat: ${payload.latitude}, lng: ${payload.longitude}, status: ${payload.status}) by ${user.name}.`,
                },
            });
            return {
                vessel: updatedVessel,
                latestHistory: historyEntry,
            };
        });
        return result;
    }
    /**
     * Fetch full location history with pagination
     */
    static async getLocationHistory(id, page, limit) {
        const vessel = await prisma.vessel.findFirst({
            where: { id, deletedAt: null },
        });
        if (!vessel) {
            throw new error_1.AppError('Vessel not found.', 404);
        }
        const skip = (page - 1) * limit;
        const [history, total] = await Promise.all([
            prisma.vesselLocationHistory.findMany({
                where: { vesselId: id },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    updatedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
            prisma.vesselLocationHistory.count({
                where: { vesselId: id },
            }),
        ]);
        return {
            history,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    /**
     * Export JSON snapshot of all vessels grouped by status
     */
    static async getExportSnapshot() {
        const vessels = await prisma.vessel.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                registrationNo: true,
                type: true,
                currentLocation: true,
                latitude: true,
                longitude: true,
                status: true,
                updatedAt: true,
                updatedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        const grouped = {
            [client_1.VesselStatus.ACTIVE]: [],
            [client_1.VesselStatus.IN_PORT]: [],
            [client_1.VesselStatus.MAINTENANCE]: [],
            [client_1.VesselStatus.NON_COMPLIANT]: [],
        };
        for (const v of vessels) {
            if (grouped[v.status]) {
                grouped[v.status].push(v);
            }
        }
        return {
            generatedAt: new Date().toISOString(),
            totalVessels: vessels.length,
            vesselsGroupedByStatus: grouped,
            vesselsList: vessels,
        };
    }
}
exports.VesselsService = VesselsService;
