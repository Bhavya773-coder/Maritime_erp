"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.logout = exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../../config/db"));
const env_1 = require("../../config/env");
const error_1 = require("../../middleware/error");
const COOKIE_NAME = 'accessToken';
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await db_1.default.user.findUnique({
            where: { email },
        });
        if (!user) {
            throw new error_1.AppError('Invalid email or password', 401);
        }
        if (!user.isActive) {
            throw new error_1.AppError('Your account has been deactivated. Please contact support.', 403);
        }
        const isPasswordValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new error_1.AppError('Invalid email or password', 401);
        }
        // Sign JWT access token (valid for 8 hours)
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            email: user.email,
            role: user.role,
        }, env_1.env.JWT_SECRET, { expiresIn: '8h' });
        // Set cookie
        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: env_1.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
        });
        // Write to audit log (ignoring database errors to not block login if it fails)
        try {
            await db_1.default.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'USER_LOGIN',
                    details: `User logged in from IP ${req.ip}`,
                },
            });
        }
        catch (dbErr) {
            console.error('Failed to write login audit log:', dbErr);
        }
        return res.status(200).json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    department: user.department,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const logout = async (req, res, next) => {
    try {
        if (req.user) {
            try {
                await db_1.default.auditLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'USER_LOGOUT',
                        details: `User logged out`,
                    },
                });
            }
            catch (dbErr) {
                console.error('Failed to write logout audit log:', dbErr);
            }
        }
        res.clearCookie(COOKIE_NAME, {
            httpOnly: true,
            secure: env_1.env.NODE_ENV === 'production',
            sameSite: 'lax',
        });
        return res.status(200).json({
            status: 'success',
            message: 'Logged out successfully',
        });
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const me = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new error_1.AppError('Not authenticated', 401);
        }
        return res.status(200).json({
            status: 'success',
            data: {
                user: req.user,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
exports.me = me;
