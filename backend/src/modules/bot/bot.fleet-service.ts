import prisma from '../../config/db';
import { VesselType, VesselStatus } from '@prisma/client';
import { FleetQuery } from './bot.fleet-parser';
import { getVesselNameCandidates } from './bot.utils';

function getCoords(location: string): { latitude: number; longitude: number } {
  const loc = location.toLowerCase().trim();
  if (loc.includes('chhara')) return { latitude: 20.7394, longitude: 70.7482 };
  if (loc.includes('pipavav')) return { latitude: 20.9167, longitude: 71.5000 };
  if (loc.includes('karwar')) return { latitude: 14.8094, longitude: 74.1306 };
  if (loc.includes('male')) return { latitude: 4.1753, longitude: 73.5093 };
  if (loc.includes('sikka')) return { latitude: 22.4332, longitude: 69.8329 };
  if (loc.includes('mumbai')) return { latitude: 18.9750, longitude: 72.8258 };
  if (loc.includes('dabhol')) return { latitude: 17.5833, longitude: 73.1667 };
  if (loc.includes('kudankulam')) return { latitude: 8.1692, longitude: 77.7122 };
  if (loc.includes('dahej')) return { latitude: 21.7119, longitude: 72.5292 };
  if (loc.includes('mul dwarka') || loc.includes('dawarka')) return { latitude: 20.7582, longitude: 70.6629 };
  if (loc.includes('bedi')) return { latitude: 22.5081, longitude: 70.0382 };
  if (loc.includes('mangalore') || loc.includes('menglore')) return { latitude: 12.9141, longitude: 74.8560 };
  return { latitude: 22.5694, longitude: 70.0242 }; // Jamnagar default
}

export class BotFleetService {
  public static async executeQuery(query: FleetQuery, updaterId?: string): Promise<string> {
    if (query.type === 'UPDATE_LOCATION') {
      const name = query.vesselName || '';
      const newLoc = query.newLocation || '';

      if (!newLoc) {
        return 'Please specify a new location. Format: "Update [Vessel] location to [New Location]"';
      }

      const candidates = getVesselNameCandidates(name);
      let vessel = null;
      for (const c of candidates) {
        vessel = await prisma.vessel.findFirst({
          where: { name: { mode: 'insensitive', equals: c }, deletedAt: null }
        }) || await prisma.vessel.findFirst({
          where: { name: { mode: 'insensitive', contains: c }, deletedAt: null }
        });
        if (vessel) break;
      }

      if (!vessel) {
        return `Vessel "${name}" not found in our fleet database.`;
      }

      const coords = getCoords(newLoc);
      
      await prisma.vessel.update({
        where: { id: vessel.id },
        data: {
          currentLocation: newLoc,
          latitude: coords.latitude,
          longitude: coords.longitude
        }
      });

      let updaterUserId = updaterId;
      if (!updaterUserId) {
        const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
        updaterUserId = owner?.id;
      }

      if (updaterUserId) {
        await prisma.vesselLocationHistory.create({
          data: {
            vesselId: vessel.id,
            location: newLoc,
            latitude: coords.latitude,
            longitude: coords.longitude,
            updatedById: updaterUserId
          }
        });
      }

      return `Successfully updated location of ${vessel.name.trim()} to "${newLoc}".`;
    }

    if (query.type === 'SINGLE_VESSEL') {
      const name = query.vesselName || '';
      
      // Find vessel by name (case-insensitive, exact or prefix)
      const candidates = getVesselNameCandidates(name);
      let targetVessel = null;
      for (const c of candidates) {
        targetVessel = await prisma.vessel.findFirst({
          where: { name: { mode: 'insensitive', equals: c }, deletedAt: null }
        }) || await prisma.vessel.findFirst({
          where: { name: { mode: 'insensitive', contains: c }, deletedAt: null }
        });
        if (targetVessel) break;
      }

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
