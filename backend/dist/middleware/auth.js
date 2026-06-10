"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const error_1 = require("./error");
const db_1 = __importDefault(require("../config/db"));
const client_1 = require("@prisma/client");
const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken;
        if (!token) {
            throw new error_1.AppError('Authentication required. Please log in.', 401);
        }
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        // Verify user exists and is active
        const user = await db_1.default.user.findUnique({
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
            throw new error_1.AppError('The user session is invalid. User no longer exists.', 401);
        }
        if (!user.isActive) {
            throw new error_1.AppError('Your account has been deactivated.', 403);
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
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuth = requireAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new error_1.AppError('Authentication required.', 401);
            }
            // OWNER always has full access
            if (req.user.role === client_1.Role.OWNER) {
                return next();
            }
            if (!allowedRoles.includes(req.user.role)) {
                throw new error_1.AppError('Access denied. You do not have permission to perform this action.', 403);
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.requireRole = requireRole;
