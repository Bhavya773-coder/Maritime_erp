"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const server = app_1.default.listen(env_1.env.PORT, () => {
    console.log(`🚀 Maritime ERP Server listening on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode`);
});
// Graceful shutdowns
process.on('unhandledRejection', (err) => {
    console.error('💥 Unhandled Rejection! Shutting down server...');
    console.error(err);
    server.close(() => {
        process.exit(1);
    });
});
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception! Shutting down server...');
    console.error(err);
    process.exit(1);
});
