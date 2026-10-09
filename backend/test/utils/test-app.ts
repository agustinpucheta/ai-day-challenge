import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import type { Env } from '../../src/config/env';
import { PrismaService } from '../../src/prisma/prisma.service';
import { assertTestDatabase } from './test-database';

export const API = '/api/v1';
export const PASSWORD = 'a-long-local-password-123';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  webOrigin: string;
  /** Cookie-keeping client that sends the allowed Origin, like the real frontend. */
  agent(): TestAgent;
  close(): Promise<void>;
}

/**
 * A fresh application per test keeps the in-memory throttler state isolated.
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestContext> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const webOrigin = app.get<ConfigService<Env, true>>(ConfigService).get('WEB_ORIGIN', {
    infer: true,
  });
  await resetDatabase(prisma);
  return {
    app,
    prisma,
    webOrigin,
    agent: () => request.agent(app.getHttpServer()).set('Origin', webOrigin),
    close: () => app.close(),
  };
}

async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL ?? '');
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "audit_events", "jira_connections", "oauth_states", "user_preferences", "external_identities", "user_sessions", "users" CASCADE',
  );
}

export async function registerAndLogin(
  ctx: TestContext,
  email: string,
  password = PASSWORD,
): Promise<TestAgent> {
  const agent = ctx.agent();
  await agent.post(`${API}/auth/register`).send({ email, password }).expect(201);
  await agent.post(`${API}/auth/login`).send({ email, password }).expect(200);
  return agent;
}
