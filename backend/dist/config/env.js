"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    JWT_SECRET: zod_1.z.string().min(16, 'JWT Secret must be at least 16 characters'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16, 'JWT Refresh Secret must be at least 16 characters'),
    CLIENT_URL: zod_1.z.string().url().default('http://localhost:5173'),
    PORT: zod_1.z.coerce.number().default(5000),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    WHATSAPP_VERIFY_TOKEN: zod_1.z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: zod_1.z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: zod_1.z.string().optional(),
    WHATSAPP_API_VERSION: zod_1.z.string().default('v20.0'),
    WHATSAPP_TEMPLATE_NAME: zod_1.z.string().optional(),
    WHATSAPP_TEMPLATE_LANG: zod_1.z.string().default('en'),
    // AI Service (new)
    AI_CHAT_ENDPOINT: zod_1.z.string().url().optional(),
    AI_MODEL: zod_1.z.string().default('llama3:latest'),
    LLAMA_API_URL: zod_1.z.string().optional(), // legacy fallback
    LLAMA_MODEL_NAME: zod_1.z.string().default('llama3'),
    LLAMA_API_KEY: zod_1.z.string().optional(),
    // Meta Webhook Security (new)
    META_APP_SECRET: zod_1.z.string().optional(),
    // Document Security (new)
    DOCUMENT_SIGNING_SECRET: zod_1.z.string().optional(),
    DOCUMENT_URL_EXPIRY_MINUTES: zod_1.z.coerce.number().default(60),
    // Rate Limiting (new)
    RATE_LIMIT_WHATSAPP_WINDOW_MS: zod_1.z.coerce.number().default(60000),
    RATE_LIMIT_WHATSAPP_MAX: zod_1.z.coerce.number().default(30),
    // Business Hours (new)
    BUSINESS_HOURS_START: zod_1.z.string().default('08:00'),
    BUSINESS_HOURS_END: zod_1.z.string().default('20:00'),
    TIMEZONE: zod_1.z.string().default('Asia/Kolkata'),
    // Compliance Reminders (new)
    COMPLIANCE_REMINDER_OWNER_IDS: zod_1.z.string().optional(),
    COMPLIANCE_REMINDER_STAFF_IDS: zod_1.z.string().optional(),
    // Job Scheduler (new)
    ENABLE_CRON_JOBS: zod_1.z.string().default('true'),
    REMINDER_CRON_EXPRESSION: zod_1.z.string().default('0 8 * * *'),
    IDEMPOTENCY_CLEANUP_CRON: zod_1.z.string().default('0 2 * * *'),
    // Legacy
    SERVER_BASE_URL: zod_1.z.string().url().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
}
exports.env = parsed.data;
