import prisma from '../src/config/db';

async function main() {
  console.log("Attempting to delete documents to free up space...");
  try {
    const result = await prisma.vesselDocument.deleteMany({});
    console.log(`Successfully deleted ${result.count} documents.`);
  } catch (err: any) {
    console.error("Failed to deleteMany:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
