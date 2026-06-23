import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/db';
import { AppError } from '../../middleware/error';
import fs from 'fs';
import path from 'path';

function buildDownloadUrl(req: AuthRequest, docId: string): string {
  const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/vessels/documents/${docId}/download`;
}

export const getVesselDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const vessel = await prisma.vessel.findUnique({ where: { id, deletedAt: null } });
    if (!vessel) throw new AppError('Vessel not found.', 404);

    const docs = await prisma.vesselDocument.findMany({
      where: { vesselId: id },
      orderBy: { uploadedAt: 'desc' },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        documents: docs.map(d => ({
          ...d,
          downloadUrl: buildDownloadUrl(req, d.id),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const searchVesselDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, type } = req.query as { name?: string; type?: string };

    const vessels = await prisma.vessel.findMany({
      where: {
        deletedAt: null,
        ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      },
      include: {
        documents: {
          where: type ? { docType: type } : {},
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        results: vessels.map(v => ({
          vesselId: v.id,
          vesselName: v.name,
          vesselType: v.type,
          documents: v.documents.map(d => ({
            ...d,
            downloadUrl: buildDownloadUrl(req, d.id),
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadVesselDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { docId } = req.params;
    const doc = await prisma.vesselDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new AppError('Document not found.', 404);

    const chunks = await prisma.vesselDocumentChunk.findMany({
      where: { docId },
      orderBy: { chunkNo: 'asc' },
    });

    if (chunks.length === 0 && doc.filePath) {
      // Fallback to static on-disk serving if no database chunks exist
      const absolutePath = path.join(__dirname, '..', '..', '..', doc.filePath);
      if (fs.existsSync(absolutePath)) {
        res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
        return res.sendFile(absolutePath);
      }
    }

    const fileDataB64 = chunks.map(c => c.data).join('');
    const fileBuffer = Buffer.from(fileDataB64, 'base64');

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    return res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
};
