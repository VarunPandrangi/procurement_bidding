import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRY_MINUTES: z.string().default('15').transform(Number),
  JWT_REFRESH_EXPIRY_DAYS: z.string().default('7').transform(Number),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  RATE_LIMIT_WINDOW_MINUTES: z.string().default('15').transform(Number),
  RATE_LIMIT_MAX_ATTEMPTS: z.string().default('5').transform(Number),
  SUPPLIER_LINK_EXPIRY_HOURS: z.string().default('72').transform(Number),
  SUPPLIER_LINK_SECRET: z.string().min(10),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  throw new Error(`Environment validation failed:\n${JSON.stringify(formatted, null, 2)}`);
}

export const env = parsed.data;
