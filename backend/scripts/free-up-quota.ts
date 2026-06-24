import prisma from '../src/config/db';

async function main() {
  // Find vessels matching KB 25 or KB 26
  const targetVessels = await prisma.vessel.findMany({
    where: {
      OR: [
        { name: { contains: 'KB 25', mode: 'insensitive' } },
        { name: { contains: 'KB 26', mode: 'insensitive' } },
        { name: { contains: 'KB-25', mode: 'insensitive' } },
        { name: { contains: 'KB-26', mode: 'insensitive' } },
      ]
    }
  });

  const targetVesselIds = targetVessels.map(v => v.id);
  console.log(`Target vessels for keeping base64 documents:`, targetVessels.map(v => v.name));

  // Count docs before clearing
  const totalDocs = await prisma.vesselDocument.count();
  const keptDocs = await prisma.vesselDocument.count({
    where: { vesselId: { in: targetVesselIds } }
  });

  console.log(`Total documents in database: ${totalDocs}`);
  console.log(`Documents to keep base64: ${keptDocs}`);

  // Clear fileDataB64 for all other documents
  const result = await prisma.vesselDocument.updateMany({
    where: {
      vesselId: { notIn: targetVesselIds }
    },
    data: {
      fileDataB64: null,
      fileSizeBytes: null
    }
  });

  console.log(`Cleared base64 data for ${result.count} documents to free up MongoDB Atlas space.`);

  // Verify DB is writable by doing a test update or check size
  console.log(`Verifying DB write capability...`);
  const testUser = await prisma.user.findFirst();
  if (testUser) {
    await prisma.user.update({
      where: { id: testUser.id },
      data: { name: testUser.name }
    });
    console.log(`✅ Success: Database is writable again!`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
