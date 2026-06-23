"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const bot_reminder_service_1 = require("./modules/bot/bot.reminder-service");
const bot_personal_reminder_service_1 = require("./modules/bot/bot.personal-reminder-service");
const server = app_1.default.listen(env_1.env.PORT, () => {
    console.log(`🚀 Maritime ERP Server listening on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode`);
    // Run due reminders check immediately on server startup after a 5 second delay
    setTimeout(async () => {
        try {
            console.log('[Scheduler] Running initial due reminders check...');
            const stats = await bot_reminder_service_1.BotReminderService.processDueReminders();
            console.log('[Scheduler] Initial reminders check finished:', stats);
        }
        catch (err) {
            console.error('[Scheduler] Error running initial reminders check:', err);
        }
    }, 5000);
    // Run due personal reminders check immediately on server startup after a 7 second delay
    setTimeout(async () => {
        try {
            console.log('[Scheduler] Running initial due personal reminders check...');
            const stats = await bot_personal_reminder_service_1.BotPersonalReminderService.processDuePersonalReminders();
            console.log('[Scheduler] Initial personal reminders check finished:', stats);
        }
        catch (err) {
            console.error('[Scheduler] Error running initial personal reminders check:', err);
        }
    }, 7000);
    // Set up repeating due reminders check every 5 minutes
    setInterval(async () => {
        try {
            console.log('[Scheduler] Running due reminders check...');
            const stats = await bot_reminder_service_1.BotReminderService.processDueReminders();
            console.log('[Scheduler] Reminders check finished:', stats);
        }
        catch (err) {
            console.error('[Scheduler] Error running reminders check:', err);
        }
    }, 5 * 60 * 1000); // 5 minutes
    // Set up repeating due personal reminders check every 1 minute
    setInterval(async () => {
        try {
            console.log('[Scheduler] Running due personal reminders check...');
            const stats = await bot_personal_reminder_service_1.BotPersonalReminderService.processDuePersonalReminders();
            console.log('[Scheduler] Personal reminders check finished:', stats);
        }
        catch (err) {
            console.error('[Scheduler] Error running personal reminders check:', err);
        }
    }, 1 * 60 * 1000); // 1 minute
    // Start self-pinging keep-alive mechanism to prevent Render Free Tier spin-down
    const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_EXTERNAL_URL) {
        console.log(`[Keep-Awake] Configured self-ping for ${RENDER_EXTERNAL_URL}`);
        const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
        setInterval(() => {
            const healthUrl = `${RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`;
            console.log(`[Keep-Awake] Pinging health endpoint: ${healthUrl}`);
            const client = healthUrl.startsWith('https') ? https_1.default : http_1.default;
            client.get(healthUrl, (res) => {
                console.log(`[Keep-Awake] Ping response status: ${res.statusCode}`);
            }).on('error', (error) => {
                console.error(`[Keep-Awake] Error during ping: ${error.message}`);
            });
        }, PING_INTERVAL_MS);
    }
    else {
        console.log('[Keep-Awake] RENDER_EXTERNAL_URL not set. Skipping self-pinging.');
    }
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
