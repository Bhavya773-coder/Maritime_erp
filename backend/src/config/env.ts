import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, 'JWT Secret must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT Refresh Secret must be at least 16 characters'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v20.0'),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en'),
  // AI Service (new)
  AI_CHAT_ENDPOINT: z.string().url().optional(),
  AI_MODEL: z.string().default('llama3:latest'),
  LLAMA_API_URL: z.string().optional(), // legacy fallback
  LLAMA_MODEL_NAME: z.string().default('llama3'),
  LLAMA_API_KEY: z.string().optional(),
  // Meta Webhook Security (new)
  META_APP_SECRET: z.string().optional(),
  // Document Security (new)
  DOCUMENT_SIGNING_SECRET: z.string().optional(),
  DOCUMENT_URL_EXPIRY_MINUTES: z.coerce.number().default(60),
  // Rate Limiting (new)
  RATE_LIMIT_WHATSAPP_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_WHATSAPP_MAX: z.coerce.number().default(30),
  // Business Hours (new)
  BUSINESS_HOURS_START: z.string().default('08:00'),
  BUSINESS_HOURS_END: z.string().default('20:00'),
  TIMEZONE: z.string().default('Asia/Kolkata'),
  // Compliance Reminders (new)
  COMPLIANCE_REMINDER_OWNER_IDS: z.string().optional(),
  COMPLIANCE_REMINDER_STAFF_IDS: z.string().optional(),
  // Job Scheduler (new)
  ENABLE_CRON_JOBS: z.string().default('true'),
  REMINDER_CRON_EXPRESSION: z.string().default('0 8 * * *'),
  IDEMPOTENCY_CLEANUP_CRON: z.string().default('0 2 * * *'),
  // Legacy
  SERVER_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
