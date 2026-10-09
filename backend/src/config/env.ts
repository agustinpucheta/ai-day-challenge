import { resolve } from 'node:path';
import { z } from 'zod';
import type { TokenKeyring } from '../crypto/token-cipher';

/** The backend reads the repository root .env (backend/ is the process cwd). */
export const ROOT_ENV_FILE = resolve(process.cwd(), '..', '.env');

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/** Empty strings (for example `VAR=` in .env) count as unset. */
const emptyAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema);

const AES_KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Base64 text that decodes to exactly 32 bytes. The value is never echoed in errors. */
const aesKey = z
  .string()
  .refine((value) => BASE64.test(value) && Buffer.from(value, 'base64').length === AES_KEY_BYTES, {
    message: 'must be base64 that decodes to exactly 32 bytes',
  });

const previousKeys = z.string().transform((value, ctx): Record<string, string> => {
  const invalid = (message: string): Record<string, string> => {
    ctx.issues.push({ code: 'custom', message, input: undefined });
    return {};
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return invalid('must be a JSON object');
  }
  const result = z.record(z.string().regex(/^[1-9]\d*$/), aesKey).safeParse(parsed);
  return result.success ? result.data : invalid('must map key versions to 32-byte base64 keys');
});

function oauthConfigured(env: {
  ATLASSIAN_CLIENT_ID?: string;
  ATLASSIAN_CLIENT_SECRET?: string;
  ATLASSIAN_REDIRECT_URI?: string;
}): boolean {
  return Boolean(
    env.ATLASSIAN_CLIENT_ID && env.ATLASSIAN_CLIENT_SECRET && env.ATLASSIAN_REDIRECT_URI,
  );
}

export const envSchema = z
  .object({
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
    /** Token encryption (AES-256-GCM). Required only when Jira OAuth is configured. */
    TOKEN_ENCRYPTION_KEY: emptyAsUnset(aesKey.optional()),
    TOKEN_ENCRYPTION_KEY_VERSION: emptyAsUnset(z.coerce.number().int().min(1).default(1)),
    /** Optional JSON map of retired key versions, kept only to decrypt old data. */
    TOKEN_ENCRYPTION_PREVIOUS_KEYS: emptyAsUnset(previousKeys.optional()),
    /** Atlassian OAuth 2.0 (3LO). All optional so the API boots without Jira. */
    ATLASSIAN_CLIENT_ID: emptyAsUnset(z.string().optional()),
    ATLASSIAN_CLIENT_SECRET: emptyAsUnset(z.string().optional()),
    ATLASSIAN_REDIRECT_URI: emptyAsUnset(
      z.url({ protocol: /^https?$/, message: 'must be an http(s) URL' }).optional(),
    ),
    ATLASSIAN_SCOPES: emptyAsUnset(
      z.string().default('read:jira-work write:jira-work offline_access'),
    ),
    ATLASSIAN_AUTH_BASE_URL: emptyAsUnset(z.url().default('https://auth.atlassian.com')),
    ATLASSIAN_API_BASE_URL: emptyAsUnset(z.url().default('https://api.atlassian.com')),
  })
  .superRefine((env, ctx) => {
    if (oauthConfigured(env) && env.TOKEN_ENCRYPTION_KEY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TOKEN_ENCRYPTION_KEY'],
        message: 'is required when Atlassian OAuth is configured',
      });
    }
    if (
      env.NODE_ENV === 'production' &&
      env.ATLASSIAN_REDIRECT_URI !== undefined &&
      new URL(env.ATLASSIAN_REDIRECT_URI).protocol !== 'https:'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ATLASSIAN_REDIRECT_URI'],
        message: 'must use https in production',
      });
    }
  })
  .transform((env) => ({ ...env, jiraOAuthConfigured: oauthConfigured(env) }));

export type Env = z.infer<typeof envSchema>;

export function isSwaggerEnabled(env: Pick<Env, 'NODE_ENV' | 'SWAGGER_ENABLED'>): boolean {
  return env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production';
}

export function apiOrigin(env: Pick<Env, 'API_PORT' | 'API_ORIGIN'>): string {
  return env.API_ORIGIN ?? `http://localhost:${env.API_PORT}`;
}

/** Builds the token keyring from validated env, or null when no key is configured. */
export function tokenKeyringFromEnv(
  env: Pick<
    Env,
    'TOKEN_ENCRYPTION_KEY' | 'TOKEN_ENCRYPTION_KEY_VERSION' | 'TOKEN_ENCRYPTION_PREVIOUS_KEYS'
  >,
): TokenKeyring | null {
  if (env.TOKEN_ENCRYPTION_KEY === undefined) return null;
  const keys: Record<number, Buffer> = {};
  for (const [version, key] of Object.entries(env.TOKEN_ENCRYPTION_PREVIOUS_KEYS ?? {})) {
    keys[Number(version)] = Buffer.from(key, 'base64');
  }
  keys[env.TOKEN_ENCRYPTION_KEY_VERSION] = Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64');
  return { currentVersion: env.TOKEN_ENCRYPTION_KEY_VERSION, keys };
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
