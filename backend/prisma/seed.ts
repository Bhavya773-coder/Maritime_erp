import { PrismaClient, Role, VesselType, VesselStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

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
      name: 'Bhavya',
      email: 'owner@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Developer',
      phone: '917046674776',
    },
    {
      name: 'Jaman Fadadu',
      email: 'jaman@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
      phone: '919427574363',
    },
    {
      name: 'Hardik Chavda',
      email: 'hardik@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
      phone: '919898499903',
    },
    {
      name: 'Praful Joshi',
      email: 'praful@apil.local',
      passwordHash,
      role: Role.ACCOUNTS,
      department: 'Accounts',
      phone: '917698026808',
    },
    {
      name: 'Parag Dungrani',
      email: 'parag@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Banking',
      phone: '917600748296',
    },
    {
      name: 'Deven Chavda',
      email: 'deven@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Customs',
      phone: '918980038545',
    },
    {
      name: 'Dhaval Joisar',
      email: 'dhaval@apil.local',
      passwordHash,
      role: Role.FLEET_MANAGER,
      department: 'Fleet',
      phone: '918140653663',
    },
    {
      name: 'Ramesh Mota',
      email: 'ramesh@apil.local',
      passwordHash,
      role: Role.FLEET_MANAGER,
      department: 'Fleet',
      phone: '919925203303',
    },
    {
      name: 'Gunvant',
      email: 'gunvant@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Manufacturing',
      phone: '919824269016',
    },
    {
      name: 'Hardik Kateshiya',
      email: 'hardik.kateshiya@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'Purchase',
      phone: '918347975555',
    },
    {
      name: 'Manager Admin',
      email: 'manager@apil.local',
      passwordHash,
      role: Role.MANAGER,
      department: 'Management',
    },
    {
      name: 'Vinit Shah',
      email: 'vinit@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
      phone: '919913810000',
    },
    // AG Staff group
    {
      name: 'Yograj Jadeja',
      email: 'yograj@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '919913701567',
    },
    {
      name: 'Mukeah Mavi',
      email: 'mukeah@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '916265938981',
    },
    {
      name: 'Naresh Gayari',
      email: 'naresh@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '919256009840',
    },
    {
      name: 'Prakash Gayari',
      email: 'prakash@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '919664099778',
    },
    {
      name: 'Raman Mavi',
      email: 'raman@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '918320031448',
    },
    {
      name: 'Shri Ram Krishna AG',
      email: 'shriramkrishna@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '919752377521',
    },
    {
      name: 'Girdhar Bhagvat',
      email: 'girdhar@apil.local',
      passwordHash,
      role: Role.STAFF,
      department: 'AG',
      phone: '919913700278',
    },
    // Owners
    {
      name: 'Arvind Bhai Shah',
      email: 'arvind@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
      phone: '919913411122',
    },
    {
      name: 'Hetal Ben Shah',
      email: 'hetal@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
      phone: '919920490000',
    },
    {
      name: 'Neha Ben Shah',
      email: 'neha@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
      phone: '918202222733',
    },
    {
      name: 'Chintan Bhai Shah',
      email: 'chintan@apil.local',
      passwordHash,
      role: Role.OWNER,
      department: 'Management',
      phone: '918200005050',
    },
  ];

  console.log('Seeding users...');
  for (const u of usersData) {
    const { phone, ...userFields } = u as any;
    const dbUser = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        department: u.department,
      },
      create: userFields,
    });

    if (phone) {
      // Remove any other WhatsApp phone number contacts for this user to avoid multiple contacts accumulating
      await prisma.userContact.deleteMany({
        where: {
          userId: dbUser.id,
          channel: 'WHATSAPP',
          phoneNumber: { not: phone },
        },
      });

      await prisma.userContact.upsert({
        where: {
          userId_phoneNumber_channel: {
            userId: dbUser.id,
            phoneNumber: phone,
            channel: 'WHATSAPP',
          },
        },
        update: {
          isVerified: true,
        },
        create: {
          userId: dbUser.id,
          phoneNumber: phone,
          channel: 'WHATSAPP',
          isVerified: true,
        },
      });
    }
  }

  // 2. Seed Vessels (22 Barges + 5 Tugs) from the Excel lists
  const vesselsData = [
    // Barges from APIL Fleet list
    { name: "KB 18 (ARCADIA ADINATH)", regNo: "JMR-0005", type: VesselType.BARGE, location: "Chhara", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2017, length: 50.0, breadth: 15.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "ARCADIA VARUN ", regNo: "BP-1554", type: VesselType.BARGE, location: "Pipavav", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2019, length: 46.4, breadth: 18.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "KB 23 (ARCADIA SHREYANS)", regNo: "JMR-0011", type: VesselType.BARGE, location: "Karwar", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2019, length: 50.0, breadth: 17.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "KB 24", regNo: "JMR-0014", type: VesselType.BARGE, location: "Male Port", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2020, length: 50.0, breadth: 17.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "KB 26 ( ARCADIA AJIT)", regNo: "JMR-0018", type: VesselType.BARGE, location: "Chhara", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2020, length: 50.0, breadth: 15.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA SUPARSHVA", regNo: "JMR-0024", type: VesselType.BARGE, location: "Chhara", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2023, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "KB 25 (ARCADIA VIMAL)", regNo: "JMR-0015", type: VesselType.BARGE, location: "Mumbai", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2020, length: 50.0, breadth: 15.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "KB 28", regNo: "JMR-0016", type: VesselType.BARGE, location: "Sikka", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2020, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "KB 32", regNo: "MAR-2396-D", type: VesselType.BARGE, location: "Mumbai", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2021, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "KB 40", regNo: "MAR-2401-D", type: VesselType.BARGE, location: "Dabhol", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2022, length: 50.0, breadth: 15.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "ARCADIA SUMERU", regNo: "JMR-0013", type: VesselType.BARGE, location: "Dabhol", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2020, length: 55.0, breadth: 16.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA ZARAH", regNo: "MAR-2403-D", type: VesselType.BARGE, location: "Dabhol", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2022, length: 50.0, breadth: 15.0, depth: 3.0, irsIv: "IV", remark: "UNMANNED" },
    { name: "KB 33", regNo: "MAR-2394-D", type: VesselType.BARGE, location: "Mumbai", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2021, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA MINICA", regNo: "MAR-2400-D", type: VesselType.BARGE, location: "Mumbai", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2022, length: 55.0, breadth: 16.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA OCEANIC", regNo: "BP-1016", type: VesselType.BARGE, location: "Mumbai", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 1996, length: 40.4, breadth: 10.0, depth: 2.8, irsIv: "IV", remark: "UNMANNED" },
    { name: "ARCADIA PARSHVA", regNo: "JMR- 0025", type: VesselType.BARGE, location: "Kudankulam", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2024, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA MAHAVIR", regNo: "JMR-0026", type: VesselType.BARGE, location: "Kudankulam", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 2024, length: 50.0, breadth: 18.0, depth: 3.0, irsIv: "IRS", remark: "UNMANNED" },
    { name: "ARCADIA MAHASAGAR", regNo: "BP-1164", type: VesselType.BARGE, location: "Dahej", classification: "MOORING / CRANE / TRANSPORT BARGE", buildYear: 1999, length: 36.5, breadth: 9.9, depth: 2.75, irsIv: "IV", remark: "UNMANNED" },
    { name: "ZARAH 3", regNo: "BP-1367", type: VesselType.BARGE, location: "Chhara", classification: "SELF PROPELLED FLAT TOP", buildYear: 2021, length: 60.0, breadth: 12.5, depth: 4.0, irsIv: "I V", remark: "FUEL AND CONSUMABLE L&T ACCOUNT" },
    { name: "ZARAH 4", regNo: "BP-1373", type: VesselType.BARGE, location: "Chhara", classification: "SELF PROPELLED FLAT TOP", buildYear: 2021, length: 60.0, breadth: 12.5, depth: 4.0, irsIv: "I V", remark: "FUEL AND CONSUMABLE L&T ACCOUNT" },
    { name: "ZARAH 1", regNo: "BP-1333", type: VesselType.BARGE, location: "Chhara", classification: "SELF PROPELLED FLAT TOP", buildYear: 2021, length: 60.0, breadth: 12.0, depth: 4.0, irsIv: "I V", remark: "FUEL AND CONSUMABLE L&T ACCOUNT" },
    { name: "ZARAH 2", regNo: "BP-1342", type: VesselType.BARGE, location: "Chhara", classification: "SELF PROPELLED FLAT TOP", buildYear: 2020, length: 60.0, breadth: 12.5, depth: 4.0, irsIv: "I V", remark: "FUEL AND CONSUMABLE L&T ACCOUNT" },

    // Tugs from Insurance/Valuation/Registry sheets
    { name: "ARCADIA 1", regNo: "BP-1032", type: VesselType.TUG, location: "Mul Dwarka", classification: "TUG", buildYear: 1997, length: 15.25, breadth: 5.0, depth: 2.35, irsIv: "IV", remark: "-" },
    { name: "ARCADIA KRISHNA", regNo: "BP-1512", type: VesselType.TUG, location: "Mumbai", classification: "TUG", buildYear: 1991, length: 19.93, breadth: 6.4, depth: 4.0, irsIv: "IV", remark: "-" },
    { name: "ARCADIA VIJAY", regNo: "BP-1058", type: VesselType.TUG, location: "Bedi", classification: "TUG", buildYear: 1997, length: 15.0, breadth: 5.0, depth: 2.75, irsIv: "IV", remark: "-" },
    { name: "ARCADIA VISHAKHA", regNo: "BP-1041", type: VesselType.TUG, location: "Mumbai", classification: "TUG", buildYear: 2008, length: 20.0, breadth: 6.0, depth: 2.8, irsIv: "IV", remark: "-" },
    { name: "KB 4", regNo: "4394", type: VesselType.TUG, location: "Mangalore", classification: "TUG", buildYear: 2016, length: 20.36, breadth: 6.5, depth: 2.8, irsIv: "IRS", remark: "MMD MANGLORE" }
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
        classification: v.classification,
        buildYear: v.buildYear,
        length: v.length,
        breadth: v.breadth,
        depth: v.depth,
        irsIv: v.irsIv,
        remark: v.remark
      },
      create: {
        name: v.name,
        registrationNo: v.regNo,
        type: v.type,
        currentLocation: v.location,
        latitude: coords.latitude,
        longitude: coords.longitude,
        status: VesselStatus.IN_PORT,
        classification: v.classification,
        buildYear: v.buildYear,
        length: v.length,
        breadth: v.breadth,
        depth: v.depth,
        irsIv: v.irsIv,
        remark: v.remark
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT SEEDING — All 110 PDFs from the Bhavya zip
  // Place the unzipped folder at: backend/documents/source/Bhavya/
  // After seeding, files live in MongoDB — the source folder can be deleted.
  // ─────────────────────────────────────────────────────────────────────────────

  console.log('\nSeeding vessel documents into MongoDB...');

  // Pre-clear all documents and chunks to avoid old schema conflicts
  console.log('Clearing old vessel documents and chunks...');
  await prisma.vesselDocumentChunk.deleteMany({});
  await prisma.vesselDocument.deleteMany({});

  const DOC_SOURCE_DIR = path.join(__dirname, '..', 'documents', 'source', 'Bhavya');

  interface DocEntry {
    key: string;        // fuzzy vessel name fragment used for DB lookup
    docType: string;
    label: string;
    folder: string;     // relative path inside the Bhavya folder
    file: string;       // exact filename
  }

  const allDocuments: DocEntry[] = [
    // ── GA Plans ──────────────────────────────────────────────────────────────
    { key: 'ARCADIA 1',         docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA 1.pdf' },
    { key: 'ARCADIA ADINATH',   docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA ADINATH.pdf' },
    { key: 'ARCADIA KRISHNA',   docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA KRISHNA.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA MINICA',    docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA MINICA.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA PARSHVA.pdf' },
    { key: 'ARCADIA SUMERU',    docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA SUMERU.pdf' },
    { key: 'ARCADIA SUPARSHVA', docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA SUPARSHVA.pdf' },
    { key: 'ARCADIA VARUN',     docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA VARUN.pdf' },
    { key: 'ARCADIA VIJAY',     docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA VIJAY.pdf' },
    { key: 'ARCADIA VISHAKHA',  docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA VISHAKHA.pdf' },
    { key: 'ARCADIA ZARAH',     docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ARCADIA ZARAH.pdf' },
    { key: 'KB 23',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 23.pdf' },
    { key: 'KB 24',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 24.pdf' },
    { key: 'KB 25',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 25.pdf' },
    { key: 'KB 26',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 26.pdf' },
    { key: 'KB 28',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 28.PDF' },
    { key: 'KB 32',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 32.pdf' },
    { key: 'KB 33',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 33.pdf' },
    { key: 'KB 4',              docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 4.pdf' },
    { key: 'KB 40',             docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_KB 40.pdf' },
    { key: 'MAHASAGAR',         docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_MAHASAGAR.pdf' },
    { key: 'OCEANIC',           docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_OCEANIC.pdf' },
    // ZARAH I–IV share the same GA Plan file
    { key: 'ZARAH - I',         docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - II',        docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - III',       docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - IV',        docType: 'GA_PLAN',               label: 'GA Plan',               folder: 'GA Plan',                                     file: 'GA_ZARAH-I TO 4 (SAME).pdf' },

    // ── Stability Booklets ────────────────────────────────────────────────────
    { key: 'ARCADIA 1',         docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA 1.pdf' },
    { key: 'ARCADIA ADINATH',   docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA ADINATH.pdf' },
    { key: 'ARCADIA KRISHNA',   docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA KRISHNA.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA MINICA',    docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA MINICA.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA PARSHVA.pdf' },
    { key: 'ARCADIA SUMERU',    docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA SUMERU.pdf' },
    { key: 'ARCADIA SUPARSHVA', docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA SUPARSHVA.pdf' },
    { key: 'ARCADIA VARUN',     docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA VARUN.pdf' },
    { key: 'ARCADIA ZARAH',     docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ARCADIA ZARAH.pdf' },
    { key: 'KB 23',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 23.pdf' },
    { key: 'KB 24',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 24.pdf' },
    { key: 'KB 25',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 25.pdf' },
    { key: 'KB 26',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 26.pdf' },
    { key: 'KB 28',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 28.pdf' },
    { key: 'KB 32',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 32.pdf' },
    { key: 'KB 33',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 33.pdf' },
    { key: 'KB 4',              docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 4.pdf' },
    { key: 'KB 40',             docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_KB 40.pdf' },
    { key: 'MAHASAGAR',         docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_MAHASAGAR.pdf' },
    // ZARAH I–IV share the same Stability Booklet file
    { key: 'ZARAH - I',         docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - II',        docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - III',       docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ZARAH-I TO 4 (SAME).pdf' },
    { key: 'ZARAH - IV',        docType: 'STABILITY_BOOKLET',     label: 'Stability Booklet',     folder: 'Stability Booklet',                           file: 'STA_ZARAH-I TO 4 (SAME).pdf' },

    // ── Registry Certificates ─────────────────────────────────────────────────
    { key: 'ARCADIA 1',         docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Tugs',                file: 'REG_ARCADIA 1.pdf' },
    { key: 'ARCADIA ADINATH',   docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ARCADIA ADINATH.pdf' },
    { key: 'ARCADIA KRISHNA',   docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Tugs',                file: 'REG_ARCADIA KRISHNA.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA MINICA',    docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA MINICA.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA PARSHVA.pdf' },
    { key: 'ARCADIA SUMERU',    docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA SUMERU.pdf' },
    { key: 'ARCADIA SUPARSHVA', docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA SUPARSHVA.pdf' },
    { key: 'ARCADIA VARUN',     docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ARCADIA VARUN.pdf' },
    { key: 'ARCADIA VIJAY',     docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Tugs',                file: 'REG_ARCADIA VIJAY.pdf' },
    { key: 'ARCADIA VISHAKHA',  docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Tugs',                file: 'REG_ARCADIA VISHAKHA.pdf' },
    { key: 'ARCADIA ZARAH',     docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_ARCADIA ZARAH.pdf' },
    { key: 'KB 23',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_KB 23.pdf' },
    { key: 'KB 24',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 24.pdf' },
    { key: 'KB 25',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 25.pdf' },
    { key: 'KB 26',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 26.pdf' },
    { key: 'KB 28',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 28.pdf' },
    { key: 'KB 32',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 32.pdf' },
    { key: 'KB 33',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 33.pdf' },
    { key: 'KB 40',             docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Barges',             file: 'REG_KB 40.pdf' },
    { key: 'KB 4',              docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IRS Tugs',               file: 'REG_KB 4.pdf' },
    { key: 'MAHASAGAR',         docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_MAHASAGAR.pdf' },
    { key: 'OCEANIC',           docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_OCEANIC.pdf' },
    { key: 'ZARAH - I',         docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ZARAH-I.pdf' },
    { key: 'ZARAH - II',        docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ZARAH-II.pdf' },
    { key: 'ZARAH - III',       docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ZARAH-III.pdf' },
    { key: 'ZARAH - IV',        docType: 'REGISTRY',              label: 'Registry Certificate',  folder: 'Registry Certificate/IV Barges',              file: 'REG_ZARAH-IV.pdf' },

    // ── Insurance Certificates ────────────────────────────────────────────────
    { key: 'ARCADIA ADINATH',   docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA ADINATH.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA MINICA',    docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA MINICA.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA PARSHVA.pdf' },
    { key: 'ARCADIA SUMERU',    docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA SUMERU.pdf' },
    { key: 'ARCADIA VARUN',     docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA VARUN.pdf' },
    { key: 'ARCADIA VIJAY',     docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ ARCADIA VIJAY.pdf' },
    { key: 'ARCADIA VISHAKHA',  docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ARCADIA VISHAKHA.pdf' },
    { key: 'KB 23',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 23.pdf' },
    { key: 'KB 24',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 24.pdf' },
    { key: 'KB 25',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 25.pdf' },
    { key: 'KB 26',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 26.pdf' },
    { key: 'KB 32',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 32.pdf' },
    { key: 'KB 33',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 33.pdf' },
    { key: 'KB 4',              docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 4.pdf' },
    { key: 'KB 40',             docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_KB 40.pdf' },
    { key: 'MAHASAGAR',         docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_MAHASAGAR.pdf' },
    { key: 'OCEANIC',           docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_OCANIC.pdf' },  // typo in zip filename preserved
    { key: 'ZARAH - I',         docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ZARAH-I.pdf' },
    { key: 'ZARAH - III',       docType: 'INSURANCE_CERTIFICATE', label: 'Insurance Certificate', folder: 'Insurance',                                   file: 'INS_ZARAH-III.pdf' },

    // ── Survey Certificates ───────────────────────────────────────────────────
    { key: 'ARCADIA ADINATH',   docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ARCADIA ADINATH.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_ARCADIA PARSHVA.pdf' },
    { key: 'ARCADIA SUPARSHVA', docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_ARCADIA SUPARSHVA.pdf' },
    { key: 'ARCADIA VARUN',     docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ ARCADIA VARUN.pdf' },
    { key: 'ARCADIA VISHAKHA',  docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV TUGS',                  file: 'SUR_ARCADIA VISHAKHA.pdf' },
    { key: 'KB 24',             docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_KB 24.pdf' },
    { key: 'KB 33',             docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_KB 33.pdf' },
    { key: 'KB 4',              docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IRS BARGE',                file: 'CLA_KB 4.pdf' },
    { key: 'ZARAH - I',         docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ZARAH 1.pdf' },
    { key: 'ZARAH - II',        docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ZARAH 2.pdf' },
    { key: 'ZARAH - III',       docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ZARAH 3.pdf' },
    { key: 'ZARAH - IV',        docType: 'SURVEY_CERTIFICATE',    label: 'Survey Certificate',    folder: 'Survey Certificate/IV BARGES',                file: 'SUR_ZARAH 4.pdf' },

    // ── Load Line Certificates ────────────────────────────────────────────────
    { key: 'ARCADIA SUPARSHVA', docType: 'LOAD_LINE_CERTIFICATE', label: 'Load Line Certificate', folder: 'Survey Certificate/IRS LOAD LINE CERTIFICATE', file: 'ARCADIA SUPARSHVA - LOAD LINE CERTIFICATE.pdf' },
    { key: 'ARCADIA MAHAVIR',   docType: 'LOAD_LINE_CERTIFICATE', label: 'Load Line Certificate', folder: 'Survey Certificate/IRS LOAD LINE CERTIFICATE', file: 'LOA_ARCADIA MAHAVIR.pdf' },
    { key: 'ARCADIA PARSHVA',   docType: 'LOAD_LINE_CERTIFICATE', label: 'Load Line Certificate', folder: 'Survey Certificate/IRS LOAD LINE CERTIFICATE', file: 'LOA_ARCADIA PARSHVA.pdf' },
    { key: 'KB 24',             docType: 'LOAD_LINE_CERTIFICATE', label: 'Load Line Certificate', folder: 'Survey Certificate/IRS LOAD LINE CERTIFICATE', file: 'LOA_KB 24.pdf' },
    { key: 'KB 33',             docType: 'LOAD_LINE_CERTIFICATE', label: 'Load Line Certificate', folder: 'Survey Certificate/IRS LOAD LINE CERTIFICATE', file: 'LOA_KB 33.pdf' },
  ];

  let seededCount = 0;
  let skippedCount = 0;

  for (const entry of allDocuments) {
    const filePath = path.join(DOC_SOURCE_DIR, entry.folder, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  [DocSeed] ⚠️  File not found: ${entry.folder}/${entry.file} — skipping`);
      skippedCount++;
      continue;
    }

    let lookupKey = entry.key;
    if (lookupKey === 'ZARAH - I') lookupKey = 'ZARAH 1';
    if (lookupKey === 'ZARAH - II') lookupKey = 'ZARAH 2';
    if (lookupKey === 'ZARAH - III') lookupKey = 'ZARAH 3';
    if (lookupKey === 'ZARAH - IV') lookupKey = 'ZARAH 4';

    const vessel = await prisma.vessel.findFirst({
      where: {
        OR: [
          { name: { contains: lookupKey, mode: 'insensitive' } },
          { name: { contains: entry.key, mode: 'insensitive' } }
        ]
      },
    });

    if (!vessel) {
      console.warn(`  [DocSeed] ⚠️  No vessel found for key: "${entry.key}" — skipping`);
      skippedCount++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileDataB64 = fileBuffer.toString('base64');

    // Delete any existing doc of same type for this vessel before re-seeding
    // (allows re-running the seed safely)
    const existingDocs = await prisma.vesselDocument.findMany({
      where: { vesselId: vessel.id, docType: entry.docType, fileName: entry.file },
    });
    for (const d of existingDocs) {
      await prisma.vesselDocumentChunk.deleteMany({
        where: { docId: d.id },
      });
    }
    await prisma.vesselDocument.deleteMany({
      where: { vesselId: vessel.id, docType: entry.docType, fileName: entry.file },
    });

    // Split base64 string into chunks of 4MB (4 * 1024 * 1024 characters) to bypass MongoDB 16MB document limit
    const chunkSize = 4 * 1024 * 1024;
    const chunks: string[] = [];
    for (let i = 0; i < fileDataB64.length; i += chunkSize) {
      chunks.push(fileDataB64.slice(i, i + chunkSize));
    }

    const doc = await prisma.vesselDocument.create({
      data: {
        vesselId: vessel.id,
        docType: entry.docType,
        label: entry.label,
        fileName: entry.file,
        mimeType: 'application/pdf',
        fileSizeBytes: fileBuffer.length,
        notes: `${entry.label} for ${vessel.name}`,
      },
    });

    for (let idx = 0; idx < chunks.length; idx++) {
      await prisma.vesselDocumentChunk.create({
        data: {
          docId: doc.id,
          chunkNo: idx,
          data: chunks[idx],
        },
      });
    }

    seededCount++;
    console.log(`  [DocSeed] ✅  ${entry.label.padEnd(25)} → ${vessel.name} (${Math.round(fileBuffer.length / 1024)}KB)`);
  }

  console.log(`\nDocument seeding complete: ${seededCount} seeded, ${skippedCount} skipped.`);

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
