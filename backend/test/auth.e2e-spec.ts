import request from 'supertest';
import { API, PASSWORD, TestContext, createTestApp, registerAndLogin } from './utils/test-app';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('register -> login -> me works; logout -> me returns 401', async () => {
    const agent = ctx.agent();
    const registered = await agent
      .post(`${API}/auth/register`)
      .send({ email: '  Ana@Example.com ', password: PASSWORD, displayName: 'Ana' })
      .expect(201);
    expect(registered.body).toMatchObject({ email: 'ana@example.com', displayName: 'Ana' });

    const login = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'ana@example.com', password: PASSWORD })
      .expect(200);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('jd.sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body).toEqual({
      userId: registered.body.userId,
      email: 'ana@example.com',
      displayName: 'Ana',
      jira: { connected: false },
    });

    await agent.post(`${API}/auth/logout`).expect(204);
    const after = await agent.get(`${API}/auth/me`).expect(401);
    expect(after.body).toEqual({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
  });

  it('destroys the session server-side on logout (old cookie no longer works)', async () => {
    const agent = await registerAndLogin(ctx, 'old-cookie@example.com');
    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.email).toBe('old-cookie@example.com');

    const sessionsBefore = await ctx.prisma.userSession.count();
    expect(sessionsBefore).toBe(1);
    await agent.post(`${API}/auth/logout`).expect(204);
    expect(await ctx.prisma.userSession.count()).toBe(0);
  });

  it('issues a new session id on login (session fixation)', async () => {
    const agent = ctx.agent();
    await agent
      .post(`${API}/auth/register`)
      .send({ email: 'fix@example.com', password: PASSWORD })
      .expect(201);
    const first = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'fix@example.com', password: PASSWORD })
      .expect(200);
    const second = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'fix@example.com', password: PASSWORD })
      .expect(200);
    const sid = (res: request.Response) => String(res.headers['set-cookie']).split(';')[0];
    expect(sid(first)).not.toEqual(sid(second));
  });

  it('returns 401 UNAUTHENTICATED for /auth/me without a session', async () => {
    const res = await request(ctx.app.getHttpServer()).get(`${API}/auth/me`).expect(401);
    expect(res.body).toEqual({ code: 'UNAUTHENTICATED', message: 'Authentication required' });
  });

  it('returns identical status and body for unknown email and wrong password', async () => {
    await ctx
      .agent()
      .post(`${API}/auth/register`)
      .send({ email: 'known@example.com', password: PASSWORD })
      .expect(201);

    const unknown = await ctx
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'unknown@example.com', password: PASSWORD });
    const wrong = await ctx
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'known@example.com', password: 'definitely-the-wrong-one' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(unknown.status);
    expect(wrong.body).toEqual(unknown.body);
    expect(unknown.body).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(unknown.headers['set-cookie']).toBeUndefined();
  });

  it('rate limits login with 429 after the threshold', async () => {
    const agent = ctx.agent();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await agent
        .post(`${API}/auth/login`)
        .send({ email: 'nobody@example.com', password: PASSWORD })
        .expect(401);
    }
    const limited = await agent
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(429);
    expect(limited.body).toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests, try again later',
    });
  });

  it('rejects state-changing requests from a foreign or missing Origin', async () => {
    const server = ctx.app.getHttpServer();
    const foreign = await request(server)
      .post(`${API}/auth/register`)
      .set('Origin', 'https://evil.example')
      .send({ email: 'csrf@example.com', password: PASSWORD })
      .expect(403);
    expect(foreign.body).toEqual({
      code: 'FORBIDDEN_ORIGIN',
      message: 'Request origin is not allowed',
    });

    await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'csrf@example.com', password: PASSWORD })
      .expect(403);

    expect(await ctx.prisma.user.count()).toBe(0);
  });

  it('rejects a foreign Origin even with a valid session cookie', async () => {
    const agent = await registerAndLogin(ctx, 'victim@example.com');
    await agent
      .patch(`${API}/users/me/preferences`)
      .set('Origin', 'https://evil.example')
      .send({ showSubtasks: false })
      .expect(403);
    const prefs = await agent.get(`${API}/users/me/preferences`).expect(200);
    expect(prefs.body.showSubtasks).toBe(true);
  });

  it('validates register input (password policy, unknown fields)', async () => {
    const shortPassword = await ctx
      .agent()
      .post(`${API}/auth/register`)
      .send({ email: 'short@example.com', password: 'short' })
      .expect(400);
    expect(shortPassword.body.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(shortPassword.body)).not.toContain('"short"');

    const extra = await ctx
      .agent()
      .post(`${API}/auth/register`)
      .send({ email: 'extra@example.com', password: PASSWORD, isAdmin: true })
      .expect(400);
    expect(extra.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate registration regardless of email case', async () => {
    await ctx
      .agent()
      .post(`${API}/auth/register`)
      .send({ email: 'dup@example.com', password: PASSWORD })
      .expect(201);
    const dup = await ctx
      .agent()
      .post(`${API}/auth/register`)
      .send({ email: 'DUP@example.com', password: PASSWORD })
      .expect(409);
    expect(dup.body.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('never returns the password or its hash in any response body', async () => {
    const agent = ctx.agent();
    const bodies: string[] = [];
    bodies.push(
      JSON.stringify(
        (
          await agent
            .post(`${API}/auth/register`)
            .send({ email: 'leak@example.com', password: PASSWORD })
        ).body,
      ),
    );
    bodies.push(
      JSON.stringify(
        (
          await agent
            .post(`${API}/auth/login`)
            .send({ email: 'leak@example.com', password: PASSWORD })
        ).body,
      ),
    );
    bodies.push(JSON.stringify((await agent.get(`${API}/auth/me`)).body));
    bodies.push(JSON.stringify((await agent.get(`${API}/users/me/preferences`)).body));

    const stored = await ctx.prisma.user.findUniqueOrThrow({
      where: { emailNormalized: 'leak@example.com' },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    for (const body of bodies) {
      expect(body).not.toContain(PASSWORD);
      expect(body).not.toContain(stored.passwordHash ?? 'unreachable');
      expect(body).not.toMatch(/argon2|password|hash/i);
    }
  });

  it('records audit events without secrets', async () => {
    const agent = await registerAndLogin(ctx, 'audit@example.com');
    await ctx
      .agent()
      .post(`${API}/auth/login`)
      .send({ email: 'audit@example.com', password: 'wrong-password-value' })
      .expect(401);
    await agent.post(`${API}/auth/logout`).expect(204);

    const events = await ctx.prisma.auditEvent.findMany({ orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => [e.eventType, e.success])).toEqual([
      ['auth.register', true],
      ['auth.login', true],
      ['auth.login', false],
      ['auth.logout', true],
    ]);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain('wrong-password-value');
    expect(serialized).not.toContain('audit@example.com');
  });
});
