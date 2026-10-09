import request from 'supertest';
import { API, TestContext, createTestApp } from './utils/test-app';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('is public and reports the database without exposing configuration', async () => {
    const res = await request(ctx.app.getHttpServer()).get(`${API}/health`).expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|password|secret/i);
  });
});
