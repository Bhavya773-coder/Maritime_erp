import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { Role } from '@prisma/client';
import { AppError } from '../../middleware/error';
import prisma from '../../config/db';
import { CertsService } from '../certifications/certs.service';

/**
 * Phase 4 — Assets and Documents Import Controller
 * Handles bulk import of fleet assets and certifications from Excel files.
 */

export const importFleetFromExcel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== Role.OWNER) {
      throw new AppError('Only OWNER can import fleet data', 403);
    }

    // The Excel data is passed in the request body (from a pre-processed parser)
    const { vessels, certifications } = req.body as {
      vessels: any[];
      certifications: any[];
    };

    if (!vessels || !Array.isArray(vessels) || vessels.length === 0) {
      throw new AppError('No vessel data provided', 400);
    }

    const results = {
      vesselsCreated: 0,
      vesselsUpdated: 0,
      certificationsCreated: 0,
      certificationsUpdated: 0,
      errors: [] as string[],
    };

    // ─── Import Vessels ─────────────────────────────────────────────
    for (const v of vessels) {
      try {
        const existing = await prisma.vessel.findFirst({
          where: {
            OR: [
              { registrationNo: v.registrationNo },
              { name: { contains: v.name, mode: 'insensitive' } },
            ],
          },
        });

        const vesselData = {
          name: v.name,
          registrationNo: v.registrationNo,
          type: v.type, // 'BARGE' or 'TUG'
          currentLocation: v.currentLocation || 'Unknown',
          status: v.status || 'ACTIVE',
          classification: v.classification || null,
          buildYear: v.buildYear ? parseInt(v.buildYear) : null,
          length: v.length ? parseFloat(v.length) : null,
          breadth: v.breadth ? parseFloat(v.breadth) : null,
          depth: v.depth ? parseFloat(v.depth) : null,
          irsIv: v.irsIv || null,
          remark: v.remark || null,
        };

        if (existing) {
          await prisma.vessel.update({
            where: { id: existing.id },
            data: vesselData,
          });
          results.vesselsUpdated++;
        } else {
          await prisma.vessel.create({
            data: vesselData,
          });
          results.vesselsCreated++;
        }
      } catch (err: any) {
        results.errors.push(`Vessel "${v.name}": ${err.message}`);
      }
    }

    // ─── Import Certifications ──────────────────────────────────────
    if (certifications && certifications.length > 0) {
      for (const c of certifications) {
        try {
          // Find vessel by name
          const vessel = await prisma.vessel.findFirst({
            where: {
              name: { contains: c.vesselName, mode: 'insensitive' },
            },
          });

          if (!vessel) {
            results.errors.push(`Certification for "${c.vesselName}": vessel not found`);
            continue;
          }

          const certData = {
            vesselId: vessel.id,
            certType: c.certType, // 'SURVEY_CLASS', 'INSURANCE', 'REGISTRY', etc.
            certNumber: c.certNumber || 'TBD',
            issuingAuthority: c.issuingAuthority || 'TBD',
            issueDate: c.issueDate ? new Date(c.issueDate) : new Date(),
            expiryDate: c.expiryDate ? new Date(c.expiryDate) : new Date(),
            documentUrl: c.documentUrl || null,
            status: CertsService.computeStatus(c.expiryDate ? new Date(c.expiryDate) : new Date()),
          };

          // Check for existing certification of same type for this vessel
          const existing = await prisma.certification.findFirst({
            where: {
              vesselId: vessel.id,
              certType: certData.certType,
            },
          });

          if (existing) {
            await prisma.certification.update({
              where: { id: existing.id },
              data: certData,
            });
            results.certificationsUpdated++;
          } else {
            await prisma.certification.create({
              data: certData,
            });
            results.certificationsCreated++;
          }
        } catch (err: any) {
          results.errors.push(`Certification "${c.certType}" for "${c.vesselName}": ${err.message}`);
        }
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'FLEET_DATA_IMPORTED',
        details: `Imported ${results.vesselsCreated} new vessels, ${results.vesselsUpdated} updated, ${results.certificationsCreated} new certs, ${results.certificationsUpdated} updated certs.`,
      },
    });

    return res.status(200).json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get import status / last import summary
 */
export const getImportStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lastImport = await prisma.auditLog.findFirst({
      where: { action: 'FLEET_DATA_IMPORTED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });

    const vesselCount = await prisma.vessel.count({ where: { deletedAt: null } });
    const certCount = await prisma.certification.count();

    return res.status(200).json({
      status: 'success',
      data: {
        vesselCount,
        certificationCount: certCount,
        lastImport: lastImport || null,
      },
    });
  } catch (error) {
    next(error);
  }
};
