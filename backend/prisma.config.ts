import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL from this file instead of schema.prisma.
// The CLI scripts load the root ../.env through dotenv-cli (see package.json).
// `prisma generate` does not need a database, so a missing URL must not fail it;
// commands that do need the database fail with Prisma's own error instead.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
