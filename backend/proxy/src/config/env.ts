import { z } from 'zod';

const proxyEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TIER_6_URL: z.string().url().default('http://localhost:4006'),
  TIER_5_URL: z.string().url().default('http://localhost:4005'),
  TIER_4_URL: z.string().url().default('http://localhost:4004'),
  TIER_3_URL: z.string().url().default('http://localhost:4003'),
  TIER_2_URL: z.string().url().default('http://localhost:4002'),
  TIER_1_URL: z.string().url().default('http://localhost:4001'),
  MANUAL_TIER_OVERRIDE: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined)),
  COOLDOWN_PERIOD_MS: z.coerce.number().default(15000),
  SLIDING_WINDOW_SECONDS: z.coerce.number().default(10)
});

export type ProxyEnvConfig = z.infer<typeof proxyEnvSchema>;

let parsedProxyConfig: ProxyEnvConfig | null = null;

export function loadProxyConfig(): ProxyEnvConfig {
  if (parsedProxyConfig) {
    return parsedProxyConfig;
  }

  const result = proxyEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Proxy environment validation failed:\n${errorDetails}`);
  }

  parsedProxyConfig = result.data;
  return parsedProxyConfig;
}
