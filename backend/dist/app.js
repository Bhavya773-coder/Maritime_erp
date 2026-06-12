"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const error_1 = require("./middleware/error");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const tasks_routes_1 = __importDefault(require("./modules/tasks/tasks.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const vessels_routes_1 = __importDefault(require("./modules/vessels/vessels.routes"));
const certs_routes_1 = __importDefault(require("./modules/certifications/certs.routes"));
const vouchers_routes_1 = __importDefault(require("./modules/vouchers/vouchers.routes"));
const bot_routes_1 = __importDefault(require("./modules/bot/bot.routes"));
const app = (0, express_1.default)();
// Set security HTTP headers
app.use((0, helmet_1.default)());
// Enable CORS with credentials
app.use((0, cors_1.default)({
    origin: env_1.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Body parsing middlewares
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Rate limiting for auth routes specifically, or all API routes
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
});
app.use('/api', apiLimiter);
// Health Check Route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Maritime ERP API Server is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// Register Module Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/tasks', tasks_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/vessels', vessels_routes_1.default);
app.use('/api/certs', certs_routes_1.default);
app.use('/api/vouchers', vouchers_routes_1.default);
app.use('/api/bot', bot_routes_1.default);
// 404 Route handler
app.use(error_1.notFoundHandler);
// Centralized error handler
app.use(error_1.errorHandler);
// Nodemon trigger comment for rate limit reset
// Explicitly mounting bot routes to resolve critical GitHub issue
exports.default = app;
