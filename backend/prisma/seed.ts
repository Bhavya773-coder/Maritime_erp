import { PrismaClient, Role, VesselType, VesselStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash password using bcrypt (rounds = 12)
  const passwordHash = await bcrypt.hash('Password@123', 12);

  // 1. Seed Users with @apil.local email domains
  const usersData = [
    {
      name: 'Owner Admin',
      email: 'owner@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
    },
    {
      name: 'Jaman Fadadu',
      email: 'jaman@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Hardik Chavda',
      email: 'hardik@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Praful Joshi',
      email: 'praful@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Parag Dungrani',
      email: 'parag@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Banking',
    },
    {
      name: 'Deven Chavda',
      email: 'deven@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Customs',
    },
    {
      name: 'Dhaval Joisar',
      email: 'dhaval@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Insurance',
    },
    {
      name: 'Gunvant',
      email: 'gunvant@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Manufacturing',
    },
    {
      name: 'Hardik Kateshiya',
      email: 'hardik.kateshiya@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Purchase',
    },
    {
      name: 'Ramesh Mota',
      email: 'ramesh@apil.local',
      passwordHash,
      role: Role.FLEET_MANAGER,
      department: 'Fleet',
    },
    {
      name: 'Manager Admin',
      email: 'manager@apil.local',
      passwordHash,
      role: Role.MANAGER,
      department: 'Management',
    },
  ];

  console.log('Seeding users...');
  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  // 2. Seed Vessels (22 Barges + 5 Tugs) from the Excel lists
  const vesselsData = [
    // Barges from APIL Fleet list
    { name: 'KB 18 (ARCADIA ADINATH)', regNo: 'JMR-0005', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'ARCADIA VARUN ', regNo: 'BP-1554', type: VesselType.BARGE, location: 'Pipavav' },
    { name: 'KB 23 (ARCADIA SHREYANS)', regNo: 'JMR-0011', type: VesselType.BARGE, location: 'Karwar' },
    { name: 'KB 24', regNo: 'JMR-0014', type: VesselType.BARGE, location: 'Male Port' },
    { name: 'KB 26 ( ARCADIA AJIT)', regNo: 'JMR-0018', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'ARCADIA SUPARSHVA', regNo: 'JMR-0024', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'KB 25 (ARCADIA VIMAL)', regNo: 'JMR-0015', type: VesselType.BARGE, location: 'Mumbai' },
    { name: 'KB 28', regNo: 'JMR-0016', type: VesselType.BARGE, location: 'Sikka' },
    { name: 'KB 32', regNo: 'MAR-2396-D', type: VesselType.BARGE, location: 'Mumbai' },
    { name: 'KB 40', regNo: 'MAR-2401-D', type: VesselType.BARGE, location: 'Dabhol' },
    { name: 'ARCADIA SUMERU', regNo: 'JMR-0013', type: VesselType.BARGE, location: 'Dabhol' },
    { name: 'ARCADIA ZARAH', regNo: 'MAR-2403-D', type: VesselType.BARGE, location: 'Dabhol' },
    { name: 'KB 33', regNo: 'MAR-2394-D', type: VesselType.BARGE, location: 'Mumbai' },
    { name: 'ARCADIA MINICA', regNo: 'MAR-2400-D', type: VesselType.BARGE, location: 'Mumbai' },
    { name: 'ARCADIA OCEANIC', regNo: 'BP-1016', type: VesselType.BARGE, location: 'Mumbai' },
    { name: 'ARCADIA PARSHVA', regNo: 'JMR- 0025', type: VesselType.BARGE, location: 'Kudankulam' },
    { name: 'ARCADIA MAHAVIR', regNo: 'JMR-0026', type: VesselType.BARGE, location: 'Kudankulam' },
    { name: 'ARCADIA MAHASAGAR', regNo: 'BP-1164', type: VesselType.BARGE, location: 'Dahej' },
    { name: 'ZARAH 3', regNo: 'BP-1367', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'ZARAH 4', regNo: 'BP-1373', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'ZARAH 1', regNo: 'BP-1333', type: VesselType.BARGE, location: 'Chhara' },
    { name: 'ZARAH 2', regNo: 'BP-1342', type: VesselType.BARGE, location: 'Chhara' },

    // Tugs from Insurance/Valuation/Registry sheets
    { name: 'ARCADIA 1', regNo: 'BP-1032', type: VesselType.TUG, location: 'Mul Dwarka' },
    { name: 'ARCADIA KRISHNA', regNo: 'BP-1512', type: VesselType.TUG, location: 'Mumbai' },
    { name: 'ARCADIA VIJAY', regNo: 'BP-1058', type: VesselType.TUG, location: 'Bedi' },
    { name: 'ARCADIA VISHAKHA', regNo: 'BP-1041', type: VesselType.TUG, location: 'Mumbai' },
    { name: 'KB 4', regNo: '4394', type: VesselType.TUG, location: 'Mangalore' },
  ];

  console.log('Cleaning up old vessels...');
  const activeRegNos = vesselsData.map((v) => v.regNo);
  await prisma.vessel.deleteMany({
    where: {
      registrationNo: {
        notIn: activeRegNos,
      },
    },
  });

  console.log('Seeding vessels...');
  for (const v of vesselsData) {
    const coords = getCoords(v.location);
    await prisma.vessel.upsert({
      where: { registrationNo: v.regNo },
      update: {
        name: v.name,
        type: v.type,
        currentLocation: v.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
      create: {
        name: v.name,
        registrationNo: v.regNo,
        type: v.type,
        currentLocation: v.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: VesselStatus.IN_PORT,
      },
    });
  }

  console.log('🌱 Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('💥 Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
