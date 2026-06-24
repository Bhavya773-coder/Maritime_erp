import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const docs = await prisma.vesselDocument.findMany({
    where: {
      OR: [
        { fileDataB64: null },
        { fileDataB64: { isSet: false } }
      ]
    }
  });
  
  console.log(`Found ${docs.length} documents without base64 data.`);
  
  for (const doc of docs) {
    if (!doc.filePath) {
      console.warn(`Document ${doc.fileName} has no filePath — skipping`);
      continue;
    }
    const absPath = path.isAbsolute(doc.filePath) ? doc.filePath : path.resolve(process.cwd(), doc.filePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`File not found: ${absPath} — skipping`);
      continue;
    }
    const buffer = fs.readFileSync(absPath);
    if (buffer.length > 12 * 1024 * 1024) {
      console.warn(`⚠️ Skipping base64 migration for ${doc.fileName} — file size (${(buffer.length/1024/1024).toFixed(1)}MB) is too large for MongoDB. Will use legacy filesystem delivery.`);
      continue;
    }
    try {
      await prisma.vesselDocument.update({
        where: { id: doc.id },
        data: {
          fileDataB64: buffer.toString('base64'),
          fileSizeBytes: buffer.length,
          mimeType: 'application/pdf',
        },
      });
      console.log(`✅ Migrated: ${doc.fileName} (${Math.round(buffer.length / 1024)}KB)`);
    } catch (dbErr: any) {
      if (dbErr.message.includes('space quota') || dbErr.message.includes('8000')) {
        console.warn(`⚠️ Warning: Skipped base64 migration for ${doc.fileName} due to MongoDB Atlas space quota limit.`);
      } else {
        console.error(`❌ Failed to migrate ${doc.fileName}:`, dbErr.message);
      }
    }
  }
  console.log('Migration complete.');
}

migrate().catch(console.error).finally(() => prisma.$disconnect());
