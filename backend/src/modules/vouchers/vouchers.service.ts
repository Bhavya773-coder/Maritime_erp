import prisma from '../../config/db';
import { AppError } from '../../middleware/error';
import { VoucherStatus, Role } from '@prisma/client';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true
};

export interface CreateVoucherPayload {
  expenseType: string;
  amount: number;
  expenseDate: Date;
  vendorName: string;
  description?: string | null;
  receiptUrls: string[];
}

export interface VoucherFilters {
  status?: VoucherStatus;
  expenseType?: string;
  submittedById?: string;
  employeeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export class VouchersService {
  /**
   * Helper to write to AuditLog
   */
  private static async logAudit(userId: string, action: string, details: string) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details
        }
      });
    } catch (err) {
      console.error('Failed to log audit:', err);
    }
  }

  /**
   * GET /api/vouchers
   * Owner/Manager view of all vouchers
   */
  public static async getVouchers(filters: VoucherFilters) {
    const whereClause: any = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.expenseType) {
      whereClause.expenseType = { equals: filters.expenseType, mode: 'insensitive' };
    }
    const targetEmployeeId = filters.employeeId || filters.submittedById;
    if (targetEmployeeId) {
      whereClause.submittedById = targetEmployeeId;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.expenseDate = {};
      if (filters.dateFrom) {
        whereClause.expenseDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        whereClause.expenseDate.lte = filters.dateTo;
      }
    }

    if (filters.search) {
      whereClause.OR = [
        { vendorName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.expenseVoucher.findMany({
      where: whereClause,
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      },
      orderBy: { submittedAt: 'desc' }
    });
  }

  /**
   * GET /api/vouchers/my
   * Returns vouchers submitted by logged-in user
   */
  public static async getMyVouchers(userId: string, filters: Omit<VoucherFilters, 'submittedById' | 'employeeId'>) {
    const whereClause: any = {
      submittedById: userId
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.expenseType) {
      whereClause.expenseType = { equals: filters.expenseType, mode: 'insensitive' };
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.expenseDate = {};
      if (filters.dateFrom) {
        whereClause.expenseDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        whereClause.expenseDate.lte = filters.dateTo;
      }
    }

    if (filters.search) {
      whereClause.OR = [
        { vendorName: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.expenseVoucher.findMany({
      where: whereClause,
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      },
      orderBy: { submittedAt: 'desc' }
    });
  }

  /**
   * GET /api/vouchers/:id
   * Detail view with permission checks
   */
  public static async getVoucherById(id: string, user: { id: string; role: Role }) {
    const voucher = await prisma.expenseVoucher.findUnique({
      where: { id },
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      }
    });

    if (!voucher) {
      throw new AppError('Expense voucher not found', 404);
    }

    // Permission checks:
    // OWNER/MANAGER can view all
    const isOwnerOrManager = user.role === Role.OWNER || user.role === Role.MANAGER;
    // Submitter can view own voucher
    const isSubmitter = voucher.submittedById === user.id;
    // ACCOUNTS can view APPROVED vouchers
    const isApprovedAccounts = user.role === Role.ACCOUNTS && voucher.status === VoucherStatus.APPROVED;

    if (!isOwnerOrManager && !isSubmitter && !isApprovedAccounts) {
      throw new AppError('You do not have permission to view this voucher', 403);
    }

    // Fetch related audit summary for this voucher
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        details: { contains: id }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      ...voucher,
      auditLogs
    };
  }

  /**
   * POST /api/vouchers
   * Submit voucher
   */
  public static async createVoucher(payload: CreateVoucherPayload, userId: string, userName: string) {
    // Note: status defaults to PENDING, approvedById null, approverNote null, actionedAt null
    const voucher = await prisma.expenseVoucher.create({
      data: {
        submittedById: userId,
        expenseType: payload.expenseType,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        vendorName: payload.vendorName,
        description: payload.description || null,
        receiptUrls: payload.receiptUrls,
        status: VoucherStatus.PENDING,
        approvedById: null,
        approverNote: null,
        actionedAt: null
      },
      include: {
        submittedBy: { select: USER_SELECT }
      }
    });

    // TODO: Implement real S3 signed uploads here in the future instead of accepting arbitrary URLs.

    await this.logAudit(
      userId,
      'VOUCHER_SUBMITTED',
      `Voucher submitted by ${userName} (ID: ${userId}) for amount ${payload.amount} of type ${payload.expenseType}. Voucher ID: ${voucher.id}`
    );

    return voucher;
  }

  /**
   * POST /api/vouchers/:id/receipts
   * Append receipts
   */
  public static async addReceipts(id: string, newUrls: string[], user: { id: string; name: string; role: Role }) {
    const voucher = await prisma.expenseVoucher.findUnique({
      where: { id }
    });

    if (!voucher) {
      throw new AppError('Expense voucher not found', 404);
    }

    const isOwnerOrManager = user.role === Role.OWNER || user.role === Role.MANAGER;
    const isSubmitter = voucher.submittedById === user.id;

    if (!isOwnerOrManager && !isSubmitter) {
      throw new AppError('You do not have permission to modify this voucher', 403);
    }

    // Submitter can add receipts only if PENDING or INFO_REQUESTED
    if (isSubmitter && !isOwnerOrManager) {
      if (voucher.status !== VoucherStatus.PENDING && voucher.status !== VoucherStatus.INFO_REQUESTED) {
        throw new AppError('You can only append receipts when voucher status is PENDING or INFO_REQUESTED', 400);
      }
    }

    const updatedUrls = [...voucher.receiptUrls, ...newUrls];
    if (updatedUrls.length > 5) {
      throw new AppError('Total receipt URLs cannot exceed 5', 400);
    }

    const updatedVoucher = await prisma.expenseVoucher.update({
      where: { id },
      data: {
        receiptUrls: updatedUrls
      },
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      }
    });

    // TODO: Implement real S3 signed uploads here in the future instead of appending arbitrary URLs.

    await this.logAudit(
      user.id,
      'VOUCHER_RECEIPTS_ADDED',
      `${user.name} added ${newUrls.length} receipt URLs to voucher. Voucher ID: ${id}`
    );

    return updatedVoucher;
  }

  /**
   * PATCH /api/vouchers/:id/approve
   * Approve voucher
   */
  public static async approveVoucher(id: string, approverNote: string | null | undefined, userId: string, userName: string) {
    const voucher = await prisma.expenseVoucher.findUnique({
      where: { id }
    });

    if (!voucher) {
      throw new AppError('Expense voucher not found', 404);
    }

    if (voucher.status !== VoucherStatus.PENDING && voucher.status !== VoucherStatus.INFO_REQUESTED) {
      throw new AppError('Can only approve PENDING or INFO_REQUESTED vouchers', 400);
    }

    const updated = await prisma.expenseVoucher.update({
      where: { id },
      data: {
        status: VoucherStatus.APPROVED,
        approvedById: userId,
        approverNote: approverNote || null,
        actionedAt: new Date()
      },
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      }
    });

    await this.logAudit(
      userId,
      'VOUCHER_APPROVED',
      `Voucher approved by ${userName}. Voucher ID: ${id}`
    );

    return updated;
  }

  /**
   * PATCH /api/vouchers/:id/reject
   * Reject voucher
   */
  public static async rejectVoucher(id: string, reason: string, userId: string, userName: string) {
    const voucher = await prisma.expenseVoucher.findUnique({
      where: { id }
    });

    if (!voucher) {
      throw new AppError('Expense voucher not found', 404);
    }

    if (voucher.status !== VoucherStatus.PENDING && voucher.status !== VoucherStatus.INFO_REQUESTED) {
      throw new AppError('Can only reject PENDING or INFO_REQUESTED vouchers', 400);
    }

    const updated = await prisma.expenseVoucher.update({
      where: { id },
      data: {
        status: VoucherStatus.REJECTED,
        approvedById: userId,
        approverNote: reason,
        actionedAt: new Date()
      },
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      }
    });

    await this.logAudit(
      userId,
      'VOUCHER_REJECTED',
      `Voucher rejected by ${userName} for reason: ${reason}. Voucher ID: ${id}`
    );

    return updated;
  }

  /**
   * PATCH /api/vouchers/:id/request-info
   * Request more info
   */
  public static async requestInfo(id: string, note: string, userId: string, userName: string) {
    const voucher = await prisma.expenseVoucher.findUnique({
      where: { id }
    });

    if (!voucher) {
      throw new AppError('Expense voucher not found', 404);
    }

    if (voucher.status !== VoucherStatus.PENDING) {
      throw new AppError('Can only request info for PENDING vouchers', 400);
    }

    const updated = await prisma.expenseVoucher.update({
      where: { id },
      data: {
        status: VoucherStatus.INFO_REQUESTED,
        approvedById: userId,
        approverNote: note,
        actionedAt: new Date()
      },
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      }
    });

    await this.logAudit(
      userId,
      'VOUCHER_INFO_REQUESTED',
      `More info requested by ${userName}: ${note}. Voucher ID: ${id}`
    );

    return updated;
  }

  /**
   * GET /api/vouchers/export
   * OWNER, MANAGER, or ACCOUNTS only.
   */
  public static async exportVouchers(filters: Omit<VoucherFilters, 'search' | 'submittedById'>, userId: string) {
    const whereClause: any = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }
    if (filters.expenseType) {
      whereClause.expenseType = { equals: filters.expenseType, mode: 'insensitive' };
    }
    if (filters.employeeId) {
      whereClause.submittedById = filters.employeeId;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.expenseDate = {};
      if (filters.dateFrom) {
        whereClause.expenseDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        whereClause.expenseDate.lte = filters.dateTo;
      }
    }

    const vouchers = await prisma.expenseVoucher.findMany({
      where: whereClause,
      include: {
        submittedBy: { select: USER_SELECT },
        approvedBy: { select: USER_SELECT }
      },
      orderBy: { expenseDate: 'asc' }
    });

    const totalCount = vouchers.length;
    const totalAmount = vouchers.reduce((acc, curr) => acc + Number(curr.amount), 0);

    // Grouped by expense type
    const groupedByExpenseType: Record<string, { count: number; totalAmount: number }> = {};
    for (const v of vouchers) {
      const type = v.expenseType;
      if (!groupedByExpenseType[type]) {
        groupedByExpenseType[type] = { count: 0, totalAmount: 0 };
      }
      groupedByExpenseType[type].count += 1;
      groupedByExpenseType[type].totalAmount += Number(v.amount);
    }

    await this.logAudit(
      userId,
      'VOUCHER_EXPORT_GENERATED',
      `Voucher export generated by user ID: ${userId}`
    );

    return {
      generatedAt: new Date().toISOString(),
      totalCount,
      totalAmount,
      groupedByExpenseType,
      vouchers
    };
  }

  /**
   * GET /api/vouchers/summary/dashboard
   * OWNER or MANAGER only.
   */
  public static async getDashboardSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch all vouchers to calculate aggregate counts and sums in JS or run aggregates.
    // Given Postgres + Prisma, let's query the counts & amounts.
    const allVouchers = await prisma.expenseVoucher.findMany();

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let infoRequestedCount = 0;
    let pendingAmount = 0;
    let approvedAmount = 0;
    let thisMonthTotal = 0;

    const byExpenseType: Record<string, number> = {};

    for (const v of allVouchers) {
      const amt = Number(v.amount);
      
      // Counts
      if (v.status === VoucherStatus.PENDING) {
        pendingCount++;
        pendingAmount += amt;
      } else if (v.status === VoucherStatus.APPROVED) {
        approvedCount++;
        approvedAmount += amt;
      } else if (v.status === VoucherStatus.REJECTED) {
        rejectedCount++;
      } else if (v.status === VoucherStatus.INFO_REQUESTED) {
        infoRequestedCount++;
      }

      // Check if expense date is in the current month
      const expDate = new Date(v.expenseDate);
      if (expDate >= startOfMonth && expDate <= endOfMonth) {
        thisMonthTotal += amt;
      }

      // Breakdown by expense type (all statuses or approved? PRD: "byExpenseType". Let's breakdown all or approved. Usually total overall expenses, let's include all vouchers in the breakdown or approved. Let's group all voucher amounts by category).
      if (!byExpenseType[v.expenseType]) {
        byExpenseType[v.expenseType] = 0;
      }
      byExpenseType[v.expenseType] += amt;
    }

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      infoRequestedCount,
      pendingAmount,
      approvedAmount,
      thisMonthTotal,
      byExpenseType
    };
  }
}
