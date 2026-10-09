import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const BACKEND_ROOT = resolve(__dirname, '..', '..');
const ROOT_ENV_FILE = resolve(BACKEND_ROOT, '..', '.env');
const SAFE_DB_NAME = /^[a-z0-9_]+_test$/;

/** Loads the repository root .env into process.env without printing anything. */
export function loadRootEnv(): void {
  if (existsSync(ROOT_ENV_FILE)) {
    process.loadEnvFile(ROOT_ENV_FILE);
  }
}

/**
 * The e2e suite never touches the development database: it uses TEST_DATABASE_URL or
 * DATABASE_URL with "_test" appended to the database name.
 */
export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    assertTestDatabase(explicit);
    return explicit;
  }
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is not set (expected in the repository root .env)');
  }
  if (SAFE_DB_NAME.test(databaseName(base))) {
    // Already resolved earlier in this process (setup files run once per test file).
    return base;
  }
  const url = new URL(base);
  url.pathname = `/${url.pathname.replace(/^\//, '')}_test`;
  const testUrl = url.toString();
  assertTestDatabase(testUrl);
  return testUrl;
}

export function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

export function assertTestDatabase(url: string): void {
  if (!SAFE_DB_NAME.test(databaseName(url))) {
    throw new Error('Refusing to run e2e tests: the test database name must end with "_test"');
  }
}

/** Removes credentials from text before it is shown in test output. */
export function redactUrl(text: string, url: string): string {
  const parsed = new URL(url);
  let result = text.split(url).join('<test-database-url>');
  if (parsed.password) {
    result = result.split(decodeURIComponent(parsed.password)).join('<redacted>');
  }
  return result;
}
