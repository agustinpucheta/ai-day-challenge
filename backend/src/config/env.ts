import { resolve } from 'node:path';
import { z } from 'zod';

/** The backend reads the repository root .env (backend/ is the process cwd). */
export const ROOT_ENV_FILE = resolve(process.cwd(), '..', '.env');

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.url().transform((value) => new URL(value).origin),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a PostgreSQL connection URL'),
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters'),
  LOCAL_REGISTRATION_ENABLED: booleanString,
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(5),
  /** Optional. When unset, Swagger is enabled everywhere except production. */
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  /**
   * Optional public origin of the API itself (Swagger UI "Try it out" sends this Origin).
   * Defaults to http://localhost:<API_PORT>.
   */
  API_ORIGIN: z
    .url()
    .optional()
    .transform((value) => (value === undefined ? undefined : new URL(value).origin)),
});

export type Env = z.infer<typeof envSchema>;

export function isSwaggerEnabled(env: Pick<Env, 'NODE_ENV' | 'SWAGGER_ENABLED'>): boolean {
  return env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production';
}

export function apiOrigin(env: Pick<Env, 'API_PORT' | 'API_ORIGIN'>): string {
  return env.API_ORIGIN ?? `http://localhost:${env.API_PORT}`;
}

/**
 * Fails fast at startup. The error lists offending variable names only, never values.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment configuration. Check: ${keys.join(', ')}`);
  }
  return result.data;
}
