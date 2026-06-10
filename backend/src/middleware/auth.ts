import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error';
import prisma from '../config/db';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    name: string;
    department: string | null;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        department: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('The user session is invalid. User no longer exists.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated.', 403);
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      department: user.department,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required.', 401);
      }

      // OWNER always has full access
      if (req.user.role === Role.OWNER) {
        return next();
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new AppError('Access denied. You do not have permission to perform this action.', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
