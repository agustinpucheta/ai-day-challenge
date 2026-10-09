import { createHash } from 'node:crypto';
import { OAuthStateService } from '../src/jira/oauth/oauth-state.service';
import { createTestApp, type TestContext } from './utils/test-app';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('OAuthStateService (DB)', () => {
  let ctx: TestContext;
  let service: OAuthStateService;
  let userId: string;
  let otherUserId: string;

  const createUser = async (email: string): Promise<string> =>
    (await ctx.prisma.user.create({ data: { emailNormalized: email } })).id;

  beforeEach(async () => {
    ctx = await createTestApp();
    service = ctx.app.get(OAuthStateService);
    userId = await createUser('a@example.com');
    otherUserId = await createUser('b@example.com');
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('stores only the SHA-256 hash with a 10 minute expiry', async () => {
    const before = Date.now();
    const raw = await service.issue(userId, 'sid-1');
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await ctx.prisma.oAuthState.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stateHash: sha256(raw), userId, sessionId: 'sid-1' });
    expect(JSON.stringify(rows)).not.toContain(raw);
    const ttl = rows[0]!.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(9.9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000 + 5_000);
  });

  it('consumes once, then reports a replay', async () => {
    const raw = await service.issue(userId, 'sid-1');
    await expect(service.consume(raw, userId, 'sid-1')).resolves.toBe('ok');
    await expect(service.consume(raw, userId, 'sid-1')).resolves.toBe('replayed');
  });

  it('reports invalid for unknown, empty or another user state', async () => {
    const raw = await service.issue(userId, 'sid-1');
    await expect(service.consume('nope', userId, 'sid-1')).resolves.toBe('invalid');
    await expect(service.consume('', userId, 'sid-1')).resolves.toBe('invalid');
    await expect(service.consume(raw, otherUserId, 'sid-1')).resolves.toBe('invalid');
    // A failed attempt by someone else must not burn the state.
    await expect(service.consume(raw, userId, 'sid-1')).resolves.toBe('ok');
  });

  it('reports wrong_session when bound to another session', async () => {
    const raw = await service.issue(userId, 'sid-1');
    await expect(service.consume(raw, userId, 'sid-2')).resolves.toBe('wrong_session');
    await expect(service.consume(raw, userId, 'sid-1')).resolves.toBe('ok');
  });

  it('reports expired and does not consume it', async () => {
    const raw = await service.issue(userId, 'sid-1');
    await ctx.prisma.oAuthState.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });
    await expect(service.consume(raw, userId, 'sid-1')).resolves.toBe('expired');
    const row = await ctx.prisma.oAuthState.findFirstOrThrow();
    expect(row.consumedAt).toBeNull();
  });

  it('lets exactly one of two concurrent consumes win', async () => {
    const raw = await service.issue(userId, 'sid-1');
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.consume(raw, userId, 'sid-1')),
    );
    expect(results.filter((result) => result === 'ok')).toHaveLength(1);
    expect(results.filter((result) => result === 'replayed')).toHaveLength(4);
  });

  it('deletes only expired rows on cleanup', async () => {
    const stale = await service.issue(userId, 'sid-1');
    const fresh = await service.issue(userId, 'sid-1');
    await ctx.prisma.oAuthState.update({
      where: { stateHash: sha256(stale) },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(service.deleteExpired()).resolves.toBe(1);
    const remaining = await ctx.prisma.oAuthState.findMany();
    expect(remaining.map((row) => row.stateHash)).toEqual([sha256(fresh)]);
  });
});
