import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/db';
import { AppError } from '../../middleware/error';

function buildDownloadUrl(req: AuthRequest, filePath: string): string {
  const base = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return encodeURI(`${base}/${filePath}`);
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
          downloadUrl: buildDownloadUrl(req, d.filePath),
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
            downloadUrl: buildDownloadUrl(req, d.filePath),
          })),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
