import { loadRootEnv, resolveTestDatabaseUrl } from './utils/test-database';

// Runs in every e2e worker before the tests. process.env wins over the .env file
// in @nestjs/config, so these overrides are what the app sees.
loadRootEnv();
// Tests never use the owner's real Jira credentials, even if the root .env defines them.
// Empty counts as unset and, being in process.env, wins over the .env file read by ConfigModule.
for (const name of ['JIRA_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN']) process.env[name] = '';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.LOCAL_REGISTRATION_ENABLED = 'true';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '5';
