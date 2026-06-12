import { Role, VesselType, VesselStatus } from '@prisma/client';
import prisma from '../../config/db';
import { randomUUID } from 'crypto';
import { AppError } from '../../middleware/error';

interface CreateVesselPayload {
  name: string;
  registrationNo: string;
  type: VesselType;
  currentLocation: string;
  latitude: number;
  longitude: number;
  status?: VesselStatus;
}

interface UpdateLocationPayload {
  currentLocation: string;
  latitude: number;
  longitude: number;
  status: VesselStatus;
}

export class VesselsService {
  /**
   * List all visible vessels matching query criteria
   */
  public static async getVessels(filters: {
    type?: VesselType;
    status?: VesselStatus;
    search?: string;
  }) {
    const whereClause: any = { deletedAt: null };

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
  public static async getVesselById(id: string) {
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
      throw new AppError('Vessel not found.', 404);
    }

    return vessel;
  }

  /**
   * Create new vessel with initial history log (OWNER only)
   */
  public static async createVessel(payload: CreateVesselPayload, creatorId: string) {
    // Enforce uniqueness of registrationNo
    const existing = await prisma.vessel.findFirst({
      where: { registrationNo: payload.registrationNo },
    });

    if (existing) {
      throw new AppError('A vessel with this registration number already exists.', 400);
    }

    // Retrieve creator details for audit log
    const creator = await prisma.user.findUnique({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new AppError('Creator user not found.', 404);
    }

    const vesselId = randomUUID();

    // Execute in a transaction
    const [vessel] = await prisma.$transaction([
      // 1. Create vessel
      prisma.vessel.create({
        data: {
          id: vesselId,
          name: payload.name,
          registrationNo: payload.registrationNo,
          type: payload.type,
          currentLocation: payload.currentLocation,
          latitude: payload.latitude,
          longitude: payload.longitude,
          status: payload.status || VesselStatus.IN_PORT,
          updatedById: creatorId,
        },
      }),

      // 2. Create initial location history record
      prisma.vesselLocationHistory.create({
        data: {
          vesselId: vesselId,
          location: payload.currentLocation,
          latitude: payload.latitude,
          longitude: payload.longitude,
          updatedById: creatorId,
        },
      }),

      // 3. Log to AuditLog
      prisma.auditLog.create({
        data: {
          userId: creatorId,
          action: 'VESSEL_CREATED',
          details: `Vessel "${payload.name}" (${payload.type}) created with registration number ${payload.registrationNo} by ${creator.name}.`,
        },
      }),
    ]);

    return vessel;
  }

  /**
   * Update location & status of a vessel (OWNER or FLEET_MANAGER only)
   */
  public static async updateVesselLocation(
    id: string,
    payload: UpdateLocationPayload,
    user: { id: string; name: string; role: Role }
  ) {
    const vessel = await prisma.vessel.findFirst({
      where: { id, deletedAt: null },
    });

    if (!vessel) {
      throw new AppError('Vessel not found.', 404);
    }

    const [updatedVessel, historyEntry] = await prisma.$transaction([
      // 1. Update vessel state
      prisma.vessel.update({
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
      }),

      // 2. Insert new location history entry
      prisma.vesselLocationHistory.create({
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
      }),

      // 3. Write to AuditLog
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'VESSEL_LOCATION_UPDATED',
          details: `Vessel "${vessel.name}" location updated to "${payload.currentLocation}" (lat: ${payload.latitude}, lng: ${payload.longitude}, status: ${payload.status}) by ${user.name}.`,
        },
      }),
    ]);

    return {
      vessel: updatedVessel,
      latestHistory: historyEntry,
    };
  }

  /**
   * Fetch full location history with pagination
   */
  public static async getLocationHistory(id: string, page: number, limit: number) {
    const vessel = await prisma.vessel.findFirst({
      where: { id, deletedAt: null },
    });

    if (!vessel) {
      throw new AppError('Vessel not found.', 404);
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
  public static async getExportSnapshot() {
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

    const grouped: Record<VesselStatus, any[]> = {
      [VesselStatus.ACTIVE]: [],
      [VesselStatus.IN_PORT]: [],
      [VesselStatus.MAINTENANCE]: [],
      [VesselStatus.NON_COMPLIANT]: [],
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
