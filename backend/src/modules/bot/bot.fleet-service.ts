import prisma from '../../config/db';
import { VesselType, VesselStatus } from '@prisma/client';
import { FleetQuery } from './bot.fleet-parser';

export class BotFleetService {
  public static async executeQuery(query: FleetQuery): Promise<string> {
    if (query.type === 'SINGLE_VESSEL') {
      const name = query.vesselName || '';
      
      // Find vessel by name (case-insensitive, exact or prefix)
      const vessel = await prisma.vessel.findFirst({
        where: {
          name: {
            mode: 'insensitive',
            equals: name,
          },
          deletedAt: null,
        },
      });

      // Fallback: search by containing the name if exact matches nothing
      const targetVessel = vessel || await prisma.vessel.findFirst({
        where: {
          name: {
            mode: 'insensitive',
            contains: name,
          },
          deletedAt: null,
        },
      });

      if (!targetVessel) {
        return `Vessel "${name}" not found in our fleet database.`;
      }

      // Format response:
      // “ARCADIA 1
      // Status: IN_PORT
      // Location: Jamnagar Port
      // Coordinates: 22.47, 70.05
      // Last updated: [date]”
      const lat = targetVessel.latitude ? Number(targetVessel.latitude).toFixed(4) : 'N/A';
      const lng = targetVessel.longitude ? Number(targetVessel.longitude).toFixed(4) : 'N/A';
      const dateStr = targetVessel.updatedAt.toISOString();

      return `${targetVessel.name}\nStatus: ${targetVessel.status}\nLocation: ${targetVessel.currentLocation}\nCoordinates: ${lat}, ${lng}\nLast updated: ${dateStr}`;
    }

    if (query.type === 'LIST_BARGES') {
      const vessels = await prisma.vessel.findMany({
        where: { type: VesselType.BARGE, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return this.formatVesselList('Barges', vessels);
    }

    if (query.type === 'LIST_TUGS') {
      const vessels = await prisma.vessel.findMany({
        where: { type: VesselType.TUG, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return this.formatVesselList('Tugs', vessels);
    }

    if (query.type === 'LIST_IN_PORT') {
      const vessels = await prisma.vessel.findMany({
        where: { status: VesselStatus.IN_PORT, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return this.formatVesselList('Vessels in Port', vessels);
    }

    if (query.type === 'LIST_MAINTENANCE') {
      const vessels = await prisma.vessel.findMany({
        where: { status: VesselStatus.MAINTENANCE, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return this.formatVesselList('Vessels in Maintenance', vessels);
    }

    if (query.type === 'LIST_ALL') {
      const vessels = await prisma.vessel.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return this.formatVesselList('All Vessels', vessels);
    }

    return 'Unknown fleet query type.';
  }

  private static formatVesselList(title: string, vessels: any[]): string {
    if (vessels.length === 0) {
      return `${title}:\nNo vessels found.`;
    }
    let response = `${title}:\n\n`;
    vessels.forEach((v, index) => {
      response += `${index + 1}. ${v.name} — ${v.status} — ${v.currentLocation}\n`;
    });
    return response.trim();
  }
}
