"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveUsers = void 0;
const db_1 = __importDefault(require("../../config/db"));
const client_1 = require("@prisma/client");
const error_1 = require("../../middleware/error");
const getActiveUsers = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_1.AppError('Authentication required.', 401);
        }
        // Enforce RBAC at controller level: Only OWNER and MANAGER can fetch active users for dropdown assignment
        if (req.user.role !== client_1.Role.OWNER && req.user.role !== client_1.Role.MANAGER) {
            throw new error_1.AppError('Access denied. Insufficient permissions to fetch users.', 403);
        }
        const users = await db_1.default.user.findMany({
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
    }
    catch (error) {
        next(error);
    }
};
exports.getActiveUsers = getActiveUsers;
