import dotenv from 'dotenv';
import { z } from 'zod';

// Load env variables
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
  LLAMA_API_URL: z.string().optional(),
  LLAMA_MODEL_NAME: z.string().default('llama3'),
  LLAMA_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
