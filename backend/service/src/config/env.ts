import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4006),
  TIER: z.coerce.number().min(1).max(6).default(6),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  SHARD_0_DATABASE_URL: z.string().url().optional(),
  SHARD_1_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  KAFKA_BROKERS: z.string().optional()
});
export type EnvConfig = z.infer<typeof envSchema>;
let parsedConfig: EnvConfig | null = null;
export function loadConfig(): EnvConfig {
  if (parsedConfig) {
    return parsedConfig;
  }
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }
  parsedConfig = result.data;
  return parsedConfig;
}
