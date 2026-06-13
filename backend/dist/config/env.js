"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Load env variables
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
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.format());
    process.exit(1);
}
exports.env = parsed.data;
