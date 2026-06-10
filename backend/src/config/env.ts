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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
