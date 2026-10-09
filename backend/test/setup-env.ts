import { loadRootEnv, resolveTestDatabaseUrl } from './utils/test-database';

// Runs in every e2e worker before the tests. process.env wins over the .env file
// in @nestjs/config, so these overrides are what the app sees.
loadRootEnv();
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.LOCAL_REGISTRATION_ENABLED = 'true';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '5';
