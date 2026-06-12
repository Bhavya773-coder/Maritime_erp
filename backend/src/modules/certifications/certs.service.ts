import prisma from '../../config/db';
import { AppError } from '../../middleware/error';
import { CertificateStatus, Role } from '@prisma/client';

interface CreateCertPayload {
  vesselId?: string | null;
  assetType?: string | null;
  certType: string;
  certNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  documentUrl?: string | null;
}

interface UpdateCertPayload {
  vesselId?: string | null;
  assetType?: string | null;
  certType?: string;
  certNumber?: string;
  issuingAuthority?: string;
  issueDate?: Date;
  expiryDate?: Date;
  documentUrl?: string | null;
}

export class CertsService {
  /**
   * Helper to compute certificate status based on expiryDate compared to today
   */
  public static computeStatus(expiryDate: Date): CertificateStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    if (expiry.getTime() < today.getTime()) {
      return 'EXPIRED';
    }

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30) {
      return 'EXPIRING_SOON';
    }

    return 'VALID';
  }

  /**
   * Helper to calculate days to expiry
   */
  public static calculateDaysToExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get filtered list of certificates
   */
  public static async getCertificates(filters: {
    vesselId?: string;
    assetType?: string;
    certType?: string;
    status?: CertificateStatus;
    expiringWithinDays?: number;
    search?: string;
  }) {
    const whereClause: any = {};

    if (filters.vesselId) {
      whereClause.vesselId = filters.vesselId;
    }

    if (filters.assetType) {
      whereClause.assetType = { equals: filters.assetType, mode: 'insensitive' };
    }

    if (filters.certType) {
      whereClause.certType = { equals: filters.certType, mode: 'insensitive' };
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filters.expiringWithinDays !== undefined) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + filters.expiringWithinDays);
      whereClause.expiryDate = {
        gte: today,
        lte: targetDate,
      };
    }

    if (filters.search) {
      const s = filters.search.trim();
      whereClause.OR = [
        { certNumber: { contains: s, mode: 'insensitive' } },
        { issuingAuthority: { contains: s, mode: 'insensitive' } },
      ];
    }

    const certs = await prisma.certification.findMany({
      where: whereClause,
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            registrationNo: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return certs.map(c => ({
      ...c,
      daysToExpiry: this.calculateDaysToExpiry(c.expiryDate),
    }));
  }

  /**
   * Get certificate detail with alert logs
   */
  public static async getCertificateById(id: string) {
    const cert = await prisma.certification.findUnique({
      where: { id },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            registrationNo: true,
            type: true,
            status: true,
          },
        },
        alertLogs: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!cert) {
      throw new AppError('Certificate not found.', 404);
    }

    return {
      ...cert,
      daysToExpiry: this.calculateDaysToExpiry(cert.expiryDate),
    };
  }

  /**
   * Create certificate
   */
  public static async createCertificate(payload: CreateCertPayload, userId: string, userName: string) {
    // 1. Verify vessel if provided
    if (payload.vesselId) {
      const vessel = await prisma.vessel.findUnique({
        where: { id: payload.vesselId },
      });
      if (!vessel) {
        throw new AppError('The specified vessel does not exist.', 400);
      }
    }

    // 2. Compute status
    const status = this.computeStatus(payload.expiryDate);

    // 3. Create certificate
    const cert = await prisma.certification.create({
      data: {
        vesselId: payload.vesselId || null,
        assetType: payload.assetType || null,
        certType: payload.certType,
        certNumber: payload.certNumber,
        issuingAuthority: payload.issuingAuthority,
        issueDate: payload.issueDate,
        expiryDate: payload.expiryDate,
        documentUrl: payload.documentUrl || null,
        status,
      },
      include: {
        vessel: {
          select: {
            name: true,
          },
        },
      },
    });

    // 4. Log to AuditLog
    const linkText = cert.vesselId 
      ? `vessel "${cert.vessel?.name}"` 
      : `non-vessel asset "${cert.assetType}"`;
      
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CERTIFICATE_CREATED',
        details: `Certificate "${payload.certType}" (${payload.certNumber}) created for ${linkText} by ${userName}.`,
      },
    });

    return {
      ...cert,
      daysToExpiry: this.calculateDaysToExpiry(cert.expiryDate),
    };
  }

  /**
   * Update certificate
   */
  public static async updateCertificate(id: string, payload: UpdateCertPayload, userId: string, userName: string) {
    const existing = await prisma.certification.findUnique({
      where: { id },
      include: {
        vessel: { select: { name: true } },
      },
    });

    if (!existing) {
      throw new AppError('Certificate not found.', 404);
    }

    // 1. Verify vessel if provided
    if (payload.vesselId) {
      const vessel = await prisma.vessel.findUnique({
        where: { id: payload.vesselId },
      });
      if (!vessel) {
        throw new AppError('The specified vessel does not exist.', 400);
      }
    }

    // 2. Date ranges check (issueDate <= expiryDate)
    const mergedIssueDate = payload.issueDate || existing.issueDate;
    const mergedExpiryDate = payload.expiryDate || existing.expiryDate;
    if (new Date(mergedIssueDate) > new Date(mergedExpiryDate)) {
      throw new AppError('Issue date must be before or equal to expiry date.', 400);
    }

    // 3. Compute status if expiryDate changed
    const finalExpiry = payload.expiryDate || existing.expiryDate;
    const status = this.computeStatus(finalExpiry);

    // 4. Update
    const updated = await prisma.certification.update({
      where: { id },
      data: {
        vesselId: payload.vesselId !== undefined ? payload.vesselId : existing.vesselId,
        assetType: payload.assetType !== undefined ? payload.assetType : existing.assetType,
        certType: payload.certType || existing.certType,
        certNumber: payload.certNumber || existing.certNumber,
        issuingAuthority: payload.issuingAuthority || existing.issuingAuthority,
        issueDate: payload.issueDate || existing.issueDate,
        expiryDate: payload.expiryDate || existing.expiryDate,
        documentUrl: payload.documentUrl !== undefined ? payload.documentUrl : existing.documentUrl,
        status,
      },
      include: {
        vessel: {
          select: {
            name: true,
          },
        },
      },
    });

    // 5. Log to AuditLog
    const linkText = updated.vesselId 
      ? `vessel "${updated.vessel?.name}"` 
      : `non-vessel asset "${updated.assetType}"`;

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CERTIFICATE_UPDATED',
        details: `Certificate "${updated.certType}" (${updated.certNumber}) updated for ${linkText} by ${userName}.`,
      },
    });

    return {
      ...updated,
      daysToExpiry: this.calculateDaysToExpiry(updated.expiryDate),
    };
  }

  /**
   * Get certificates expiring within days, or already expired
   */
  public static async getExpiringCertificates(days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);

    // Query both expired (expiryDate < today) and expiring soon (expiryDate <= targetDate)
    const certs = await prisma.certification.findMany({
      where: {
        expiryDate: {
          lte: targetDate,
        },
      },
      include: {
        vessel: {
          select: {
            id: true,
            name: true,
            registrationNo: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return certs.map(c => ({
      ...c,
      daysToExpiry: this.calculateDaysToExpiry(c.expiryDate),
    }));
  }

  /**
   * Upload document URL
   */
  public static async uploadDocument(id: string, documentUrl: string, userId: string, userName: string) {
    const cert = await prisma.certification.findUnique({
      where: { id },
    });

    if (!cert) {
      throw new AppError('Certificate not found.', 404);
    }

    // TODO: Implement actual S3 pre-signed URL upload endpoint for PDF documents.
    // Currently, we accept a direct documentUrl placeholder link for testing.

    const updated = await prisma.certification.update({
      where: { id },
      data: { documentUrl },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CERTIFICATE_DOCUMENT_UPLOADED',
        details: `Uploaded document url placeholder for Certificate "${cert.certType}" (${cert.certNumber}) by ${userName}.`,
      },
    });

    return {
      ...updated,
      daysToExpiry: this.calculateDaysToExpiry(updated.expiryDate),
    };
  }

  /**
   * Recalculate status of all certificates
   */
  public static async recalculateStatuses(userId: string, userName: string) {
    const allCerts = await prisma.certification.findMany();
    let updatedCount = 0;
    let validCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const cert of allCerts) {
      const newStatus = this.computeStatus(cert.expiryDate);
      if (newStatus === 'VALID') validCount++;
      else if (newStatus === 'EXPIRING_SOON') expiringSoonCount++;
      else if (newStatus === 'EXPIRED') expiredCount++;

      if (cert.status !== newStatus) {
        await prisma.certification.update({
          where: { id: cert.id },
          data: { status: newStatus },
        });
        updatedCount++;
      }
    }

    // Log to AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CERTIFICATE_STATUS_RECALCULATED',
        details: `Recalculated statuses for all ${allCerts.length} certificates by ${userName}. Valid: ${validCount}, Expiring Soon: ${expiringSoonCount}, Expired: ${expiredCount}. Updated: ${updatedCount}.`,
      },
    });

    return {
      valid: validCount,
      expiringSoon: expiringSoonCount,
      expired: expiredCount,
      updated: updatedCount,
    };
  }

  /**
   * Manual alert checks for exact 90, 30, and 7 day offsets
   */
  public static async checkAlerts(userId: string, userName: string) {
    const allCerts = await prisma.certification.findMany({
      include: {
        vessel: { select: { name: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkedCount = 0;
    let alertsCreatedCount = 0;
    const alerts: any[] = [];

    for (const cert of allCerts) {
      const expiry = new Date(cert.expiryDate);
      expiry.setHours(0, 0, 0, 0);

      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 90 || diffDays === 30 || diffDays === 7) {
        checkedCount++;

        // Query alert logs to prevent duplicate entries for same cert & alertWindow
        const existingLog = await prisma.certAlertLog.findUnique({
          where: {
            certificateId_alertWindow: {
              certificateId: cert.id,
              alertWindow: diffDays,
            },
          },
        });

        if (!existingLog) {
          const log = await prisma.certAlertLog.create({
            data: {
              certificateId: cert.id,
              alertWindow: diffDays,
            },
          });

          alertsCreatedCount++;
          alerts.push({
            id: log.id,
            certificateId: cert.id,
            certNumber: cert.certNumber,
            certType: cert.certType,
            vesselName: cert.vessel?.name || null,
            assetType: cert.assetType || null,
            expiryDate: cert.expiryDate,
            alertWindow: diffDays,
            sentAt: log.sentAt,
          });
        }
      }
    }

    // Log to AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CERTIFICATE_ALERTS_CHECKED',
        details: `Ran manual certificate alert checks by ${userName}. Checked: ${checkedCount}. Alerts Created: ${alertsCreatedCount}.`,
      },
    });

    return {
      checked: checkedCount,
      alertsCreated: alertsCreatedCount,
      alerts,
    };
  }
}
