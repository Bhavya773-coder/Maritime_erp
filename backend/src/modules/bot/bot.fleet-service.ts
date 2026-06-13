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

      // Format response exactly matching the columns from Excel
      const classification = targetVessel.classification || 'N/A';
      const regNo = targetVessel.registrationNo || 'N/A';
      const buildYear = targetVessel.buildYear || 'N/A';
      const length = targetVessel.length ? Number(targetVessel.length).toString() : 'N/A';
      const breadth = targetVessel.breadth ? Number(targetVessel.breadth).toString() : 'N/A';
      const depth = targetVessel.depth ? Number(targetVessel.depth).toString() : 'N/A';
      const irsIv = targetVessel.irsIv || 'N/A';
      const location = targetVessel.currentLocation || 'N/A';
      const remark = targetVessel.remark || 'N/A';

      const nameLabel = targetVessel.type === VesselType.TUG ? 'NAME OF TUGS' : 'NAME OF BARGES';

      return `CLASSIFICATION: ${classification}
${nameLabel}: ${targetVessel.name}
REGI NO: ${regNo}
BULID YEAR: ${buildYear}
LENGTH: ${length}
BREDTH: ${breadth}
DEPTH: ${depth}
IRS / IV: ${irsIv}
PRESNT LOCATION: ${location}
REMARK: ${remark}`;
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
    let response = `${title}:\n`;
    vessels.forEach((v, index) => {
      const classification = v.classification || 'N/A';
      const regNo = v.registrationNo || 'N/A';
      const buildYear = v.buildYear || 'N/A';
      const length = v.length ? Number(v.length).toString() : 'N/A';
      const breadth = v.breadth ? Number(v.breadth).toString() : 'N/A';
      const depth = v.depth ? Number(v.depth).toString() : 'N/A';
      const irsIv = v.irsIv || 'N/A';
      const location = v.currentLocation || 'N/A';
      const remark = v.remark || 'N/A';

      const nameLabel = v.type === VesselType.TUG ? 'NAME OF TUGS' : 'NAME OF BARGES';

      response += `\nSR. NO.: ${index + 1}
CLASSIFICATION: ${classification}
${nameLabel}: ${v.name}
REGI NO: ${regNo}
BULID YEAR: ${buildYear}
LENGTH: ${length}
BREDTH: ${breadth}
DEPTH: ${depth}
IRS / IV: ${irsIv}
PRESNT LOCATION: ${location}
REMARK: ${remark}\n`;
    });
    return response.trim();
  }
}
