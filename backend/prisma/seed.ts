import { PrismaClient, Role, VesselType, VesselStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash password using bcrypt (rounds = 12)
  const passwordHash = await bcrypt.hash('Password@123', 12);

  // 1. Seed Users
  const usersData = [
    {
      name: 'Owner Admin',
      email: 'owner@sagarshipping.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
    },
    {
      name: 'Jaman Fadadu',
      email: 'jaman@sagarshipping.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Hardik Chavda',
      email: 'hardik@sagarshipping.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Praful Joshi',
      email: 'praful@sagarshipping.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
    },
    {
      name: 'Parag Dungrani',
      email: 'parag@sagarshipping.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Banking',
    },
    {
      name: 'Deven Chavda',
      email: 'deven@sagarshipping.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Customs',
    },
    {
      name: 'Dhaval Joisar',
      email: 'dhaval@sagarshipping.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Insurance',
    },
    {
      name: 'Gunvant',
      email: 'gunvant@sagarshipping.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Manufacturing',
    },
    {
      name: 'Hardik Kateshiya',
      email: 'hardik.kateshiya@sagarshipping.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Purchase',
    },
    {
      name: 'Ramesh Mota',
      email: 'ramesh@sagarshipping.local',
      passwordHash,
      role: Role.FLEET_MANAGER,
      department: 'Fleet',
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

  // 2. Seed Vessels
  const vesselsData = [
    { name: 'Sagar Barge 1', regNo: 'SSR-BARGE-001', type: VesselType.BARGE },
    { name: 'Sagar Barge 2', regNo: 'SSR-BARGE-002', type: VesselType.BARGE },
    { name: 'Sagar Barge 3', regNo: 'SSR-BARGE-003', type: VesselType.BARGE },
    { name: 'Sagar Barge 4', regNo: 'SSR-BARGE-004', type: VesselType.BARGE },
    { name: 'Sagar Barge 5', regNo: 'SSR-BARGE-005', type: VesselType.BARGE },
    { name: 'Sagar Tug 1', regNo: 'SSR-TUG-001', type: VesselType.TUG },
    { name: 'Sagar Tug 2', regNo: 'SSR-TUG-002', type: VesselType.TUG },
    { name: 'Sagar Tug 3', regNo: 'SSR-TUG-003', type: VesselType.TUG },
  ];

  console.log('Seeding vessels...');
  // Jamnagar Port coordinates: lat: 22.5694, lng: 70.0242
  const jamnagarLat = 22.5694;
  const jamnagarLng = 70.0242;

  for (const v of vesselsData) {
    await prisma.vessel.upsert({
      where: { registrationNo: v.regNo },
      update: {},
      create: {
        name: v.name,
        registrationNo: v.regNo,
        type: v.type,
        currentLocation: 'Jamnagar Port',
        latitude: jamnagarLat,
        longitude: jamnagarLng,
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
