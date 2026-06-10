import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/db';
import { Role } from '@prisma/client';
import { AppError } from '../../middleware/error';

export const getActiveUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    // Enforce RBAC at controller level: Only OWNER and MANAGER can fetch active users for dropdown assignment
    if (req.user.role !== Role.OWNER && req.user.role !== Role.MANAGER) {
      throw new AppError('Access denied. Insufficient permissions to fetch users.', 403);
    }

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return res.status(200).json({
      status: 'success',
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};
