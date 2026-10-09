import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { Env, apiOrigin } from '../src/config/env';
import { PASSWORD, TestContext, createTestApp } from './utils/test-app';

function collectPropertyNames(node: unknown, names: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((item) => collectPropertyNames(item, names));
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'properties' && typeof value === 'object' && value !== null) {
        Object.keys(value).forEach((name) => names.add(name));
      }
      collectPropertyNames(value, names);
    }
  }
  return names;
}

describe('OpenAPI docs (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('serves the JSON spec with the API paths and no credential fields', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/docs-json').expect(200);
    const body = res.body as { paths: Record<string, unknown> };
    const paths = Object.keys(body.paths);
    expect(paths).toEqual(
      expect.arrayContaining(['/api/v1/auth/login', '/api/v1/users/me/preferences']),
    );
    expect(res.body.components.securitySchemes['jd.sid']).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
    });
    const properties = collectPropertyNames(res.body);
    expect(properties.has('passwordHash')).toBe(false);
    expect(properties.has('password_hash')).toBe(false);
    expect(properties.has('code')).toBe(true);
  });

  it('serves the Swagger UI', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/docs').expect(200);
    expect(res.text).toContain('swagger');
  });

  it('accepts state-changing requests from the API own origin (Swagger "Try it out")', async () => {
    const ownOrigin = apiOrigin({
      API_PORT: ctx.app.get<ConfigService<Env, true>>(ConfigService).get('API_PORT', {
        infer: true,
      }),
      API_ORIGIN: undefined,
    });
    const agent = request.agent(ctx.app.getHttpServer()).set('Origin', ownOrigin);
    await agent
      .post('/api/v1/auth/register')
      .send({ email: 'swagger@example.com', password: PASSWORD })
      .expect(201);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'swagger@example.com', password: PASSWORD })
      .expect(200);
    await agent.get('/api/v1/auth/me').expect(200);

    // Foreign origins remain rejected.
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://evil.example')
      .expect(403);
  });
});
