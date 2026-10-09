import request from 'supertest';
import { API, TestContext, createTestApp, registerAndLogin } from './utils/test-app';

describe('Preferences (e2e)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('creates defaults lazily for the session user', async () => {
    const agent = await registerAndLogin(ctx, 'defaults@example.com');
    const res = await agent.get(`${API}/users/me/preferences`).expect(200);
    expect(res.body).toMatchObject({
      weekStartsOn: 'monday',
      timezone: null,
      showWeeklySp: true,
      showSubtasks: true,
      showDependencies: true,
    });
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('isolates users: B cannot read or modify A preferences', async () => {
    const userA = await registerAndLogin(ctx, 'a@example.com');
    const userB = await registerAndLogin(ctx, 'b@example.com');

    await userA
      .patch(`${API}/users/me/preferences`)
      .send({ weekStartsOn: 'sunday', timezone: 'America/Argentina/Buenos_Aires' })
      .expect(200);

    // B only ever sees and edits B's own row.
    const bInitial = await userB.get(`${API}/users/me/preferences`).expect(200);
    expect(bInitial.body).toMatchObject({ weekStartsOn: 'monday', timezone: null });

    const bPatch = await userB
      .patch(`${API}/users/me/preferences`)
      .send({ showSubtasks: false, timezone: 'Europe/Madrid' })
      .expect(200);
    expect(bPatch.body).toMatchObject({ showSubtasks: false, timezone: 'Europe/Madrid' });

    const aAfter = await userA.get(`${API}/users/me/preferences`).expect(200);
    expect(aAfter.body).toMatchObject({
      weekStartsOn: 'sunday',
      timezone: 'America/Argentina/Buenos_Aires',
      showSubtasks: true,
    });

    // There is no way to address another user: a client-sent userId is rejected.
    const aUser = await ctx.prisma.user.findUniqueOrThrow({
      where: { emailNormalized: 'a@example.com' },
    });
    const spoof = await userB
      .patch(`${API}/users/me/preferences`)
      .send({ userId: aUser.id, showDependencies: false })
      .expect(400);
    expect(spoof.body.code).toBe('VALIDATION_ERROR');
    await userB.get(`${API}/users/${aUser.id}/preferences`).expect(404);

    const aFinal = await userA.get(`${API}/users/me/preferences`).expect(200);
    expect(aFinal.body.showDependencies).toBe(true);
    expect(await ctx.prisma.userPreferences.count()).toBe(2);
  });

  it('returns 401 UNAUTHENTICATED without a session', async () => {
    const server = ctx.app.getHttpServer();
    const get = await request(server).get(`${API}/users/me/preferences`).expect(401);
    expect(get.body).toEqual({ code: 'UNAUTHENTICATED', message: 'Authentication required' });

    const patch = await request(server)
      .patch(`${API}/users/me/preferences`)
      .set('Origin', ctx.webOrigin)
      .send({ showSubtasks: false })
      .expect(401);
    expect(patch.body.code).toBe('UNAUTHENTICATED');
  });

  it('validates the patch body', async () => {
    const agent = await registerAndLogin(ctx, 'validate@example.com');
    const badTz = await agent
      .patch(`${API}/users/me/preferences`)
      .send({ timezone: 'Not/AZone' })
      .expect(400);
    expect(badTz.body.code).toBe('VALIDATION_ERROR');

    await agent.patch(`${API}/users/me/preferences`).send({ showWeeklySp: 'no' }).expect(400);

    const cleared = await agent
      .patch(`${API}/users/me/preferences`)
      .send({ timezone: null })
      .expect(200);
    expect(cleared.body.timezone).toBeNull();
  });
});
