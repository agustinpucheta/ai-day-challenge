import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Client } from 'pg';
import {
  BACKEND_ROOT,
  databaseName,
  loadRootEnv,
  redactUrl,
  resolveTestDatabaseUrl,
} from './utils/test-database';

/** Creates the test database if needed and applies the versioned migrations. */
export default async function globalSetup(): Promise<void> {
  loadRootEnv();
  const testUrl = resolveTestDatabaseUrl();
  const dbName = databaseName(testUrl);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (existing.rowCount === 0) {
      // dbName is validated against /^[a-z0-9_]+_test$/ before reaching this point.
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  const prismaCli = resolve(BACKEND_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: testUrl },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const output = redactUrl(`${result.stdout}\n${result.stderr}`, testUrl);
    throw new Error(`prisma migrate deploy failed for the test database:\n${output}`);
  }
}
