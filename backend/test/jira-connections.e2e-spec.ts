import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { TokenCipher } from '../src/crypto/token-cipher';
import {
  ConnectionNotFoundError,
  MultipleSitesError,
  NoAccessibleSiteError,
  ReauthorizationRequiredError,
} from '../src/jira/connections/errors';
import { JiraConnectionsService } from '../src/jira/connections/jira-connections.service';
import {
  AtlassianRateLimitedError,
  AtlassianUnavailableError,
} from '../src/jira/oauth/atlassian-errors';
import { AtlassianOAuthClient } from '../src/jira/oauth/atlassian-oauth.client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { FakeAtlassian } from './utils/fake-atlassian';
import { createTestApp, type TestContext } from './utils/test-app';

const AUTH = 'https://auth.atlassian.test';
const API = 'https://api.atlassian.test';
const keyring = { currentVersion: 1, keys: { 1: Buffer.alloc(32, 9) } };

function expectNoSecrets(error: unknown): void {
  const text = `${(error as Error).message}${JSON.stringify(error)}`;
  expect(text).not.toMatch(/access-\d|refresh-\d|code-\d|v1\.\d|client-secret/);
}

describe('JiraConnectionsService (DB + fake Atlassian)', () => {
  let ctx: TestContext;
  let fake: FakeAtlassian;
  let service: JiraConnectionsService;
  let cipher: TokenCipher;
  let prisma: PrismaService;
  let userA: string;
  let userB: string;

  const createUser = async (email: string): Promise<string> =>
    (await prisma.user.create({ data: { emailNormalized: email } })).id;
  const tokenCalls = (): number =>
    fake.requests.filter((request) => request.url.endsWith('/oauth/token')).length;
  const expire = (id: string): Promise<unknown> =>
    prisma.jiraConnection.update({
      where: { id },
      data: { accessTokenExpiresAt: new Date(Date.now() + 10_000) },
    });
  const connect = (userId = userA, preferredSiteUrl?: string) =>
    service.connectFromAuthorizationCode({ userId, code: fake.issueCode(), preferredSiteUrl });
  const audits = (type: string) => prisma.auditEvent.findMany({ where: { eventType: type } });
  const caught = (promise: Promise<unknown>): Promise<unknown> =>
    promise.then(
      () => undefined,
      (error: unknown) => error,
    );

  beforeEach(async () => {
    fake = new FakeAtlassian({ authBaseUrl: AUTH, apiBaseUrl: API });
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(TokenCipher)
        .useValue(new TokenCipher(keyring))
        .overrideProvider(AtlassianOAuthClient)
        .useValue(
          new AtlassianOAuthClient(
            {
              clientId: 'client-id',
              clientSecret: 'client-secret',
              redirectUri: 'http://localhost/cb',
              scopes: 'read:jira-work offline_access',
              authBaseUrl: AUTH,
              apiBaseUrl: API,
            },
            fake,
          ),
        ),
    );
    prisma = ctx.prisma;
    service = ctx.app.get(JiraConnectionsService);
    cipher = ctx.app.get(TokenCipher);
    userA = await createUser('a@example.com');
    userB = await createUser('b@example.com');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await ctx.close();
  });

  describe('connect', () => {
    it('stores ciphertext only, with site, scopes and active status', async () => {
      const dto = await connect();
      expect(dto).toMatchObject({
        cloudId: 'cloud-1',
        siteUrl: 'https://acme.atlassian.net',
        siteName: 'Acme',
        status: 'active',
        grantedScopes: ['read:jira-work', 'offline_access'],
      });
      expect(JSON.stringify(dto)).not.toMatch(/access-|refresh-|ciphertext/i);
      const row = await prisma.jiraConnection.findUniqueOrThrow({ where: { id: dto.id } });
      expect(JSON.stringify(row)).not.toMatch(/"(access|refresh)-\d+"/);
      expect(row.accessTokenCiphertext).toMatch(/^v1\.1\./);
      expect(row.encryptionKeyVersion).toBe(1);
      expect(cipher.decrypt(row.refreshTokenCiphertext, row.id)).toBe(fake.currentRefreshToken());
      expect(await audits('jira_connected')).toHaveLength(1);
    });

    it('reconnecting updates the same row and resets the status', async () => {
      const first = await connect();
      await prisma.jiraConnection.update({
        where: { id: first.id },
        data: { status: 'reauthorization_required' },
      });
      const second = await connect();
      expect(second.id).toBe(first.id);
      expect(second.status).toBe('active');
      expect(await prisma.jiraConnection.count()).toBe(1);
      await expect(service.getValidAccessToken(userA, first.id)).resolves.toMatch(/^access-/);
    });

    it('requires a preferred site when several are granted', async () => {
      fake.resources = [
        { id: 'c1', name: 'One', url: 'https://one.atlassian.net', scopes: [] },
        { id: 'c2', name: 'Two', url: 'https://two.atlassian.net', scopes: [], avatarUrl: 'x' },
      ];
      const error = await caught(connect());
      expect(error).toBeInstanceOf(MultipleSitesError);
      expect((error as MultipleSitesError).candidates).toEqual([
        { cloudId: 'c1', name: 'One', url: 'https://one.atlassian.net' },
        { cloudId: 'c2', name: 'Two', url: 'https://two.atlassian.net' },
      ]);
      expect(await prisma.jiraConnection.count()).toBe(0);

      const picked = await connect(userA, 'HTTPS://Two.atlassian.net/');
      expect(picked.cloudId).toBe('c2');
      await expect(connect(userA, 'https://other.atlassian.net')).rejects.toBeInstanceOf(
        MultipleSitesError,
      );
    });

    it('falls back to ATLASSIAN_PREFERRED_SITE_URL from configuration', async () => {
      fake.resources = [
        { id: 'c1', name: 'One', url: 'https://one.atlassian.net', scopes: [] },
        { id: 'c2', name: 'Two', url: 'https://two.atlassian.net', scopes: [] },
      ];
      jest
        .spyOn(ctx.app.get(ConfigService), 'get')
        .mockImplementation((key: string) =>
          key === 'ATLASSIAN_PREFERRED_SITE_URL' ? 'https://one.atlassian.net/' : undefined,
        );
      await expect(connect()).resolves.toMatchObject({ cloudId: 'c1' });
    });

    it('fails with a typed error when no site is accessible', async () => {
      fake.resources = [];
      await expect(connect()).rejects.toBeInstanceOf(NoAccessibleSiteError);
    });
  });

  describe('isolation', () => {
    it('hides other users connections with the same error as a missing id', async () => {
      const dto = await connect();
      const crossUser = await caught(service.getValidAccessToken(userB, dto.id));
      const missing = await caught(service.getValidAccessToken(userB, randomUUID()));
      expect(crossUser).toBeInstanceOf(ConnectionNotFoundError);
      expect(missing).toBeInstanceOf(ConnectionNotFoundError);
      expect((crossUser as Error).message).toBe((missing as Error).message);
      await expect(service.disconnect(userB, dto.id)).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      );
      await expect(service.getValidAccessToken(userB, 'not-a-uuid')).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      );
      expect(await prisma.jiraConnection.count()).toBe(1);
      expect(await service.listForUser(userB)).toEqual([]);
      expect(await service.listForUser(userA)).toHaveLength(1);
    });
  });

  describe('AAD binding', () => {
    it('fails closed when ciphertext is copied to another connection', async () => {
      const a = await connect();
      fake.resources = [{ id: 'cloud-2', name: 'B', url: 'https://b.atlassian.net', scopes: [] }];
      const b = await connect(userB);
      const rowA = await prisma.jiraConnection.findUniqueOrThrow({ where: { id: a.id } });
      await prisma.jiraConnection.update({
        where: { id: b.id },
        data: {
          accessTokenCiphertext: rowA.accessTokenCiphertext,
          refreshTokenCiphertext: rowA.refreshTokenCiphertext,
        },
      });
      const error = await caught(service.getValidAccessToken(userB, b.id));
      expect(error).toBeInstanceOf(ReauthorizationRequiredError);
      expectNoSecrets(error);
      const row = await prisma.jiraConnection.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.status).toBe('reauthorization_required');
      expect(await audits('jira_reauth_required')).toHaveLength(1);
    });

    it('treats an undecryptable refresh token as reauthorization required', async () => {
      const dto = await connect();
      await expire(dto.id);
      await prisma.jiraConnection.update({
        where: { id: dto.id },
        data: { refreshTokenCiphertext: 'v1.1.garbage' },
      });
      const before = tokenCalls();
      const error = await caught(service.getValidAccessToken(userA, dto.id));
      expect(error).toBeInstanceOf(ReauthorizationRequiredError);
      expectNoSecrets(error);
      expect(tokenCalls()).toBe(before);
      expect((await service.listForUser(userA))[0]!.status).toBe('reauthorization_required');
    });
  });

  describe('refresh', () => {
    it('does not call Atlassian while the token is fresh', async () => {
      const dto = await connect();
      const before = fake.requests.length;
      await expect(service.getValidAccessToken(userA, dto.id)).resolves.toMatch(/^access-/);
      expect(fake.requests).toHaveLength(before);
      expect((await service.listForUser(userA))[0]!.lastUsedAt).not.toBeNull();
    });

    it('refreshes once when expiring and rotates the refresh token', async () => {
      const dto = await connect();
      const oldRefresh = fake.currentRefreshToken()!;
      await expire(dto.id);
      const before = tokenCalls();
      const token = await service.getValidAccessToken(userA, dto.id);
      expect(tokenCalls()).toBe(before + 1);

      const row = await prisma.jiraConnection.findUniqueOrThrow({ where: { id: dto.id } });
      expect(row.lastRefreshedAt).not.toBeNull();
      expect(row.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 3_000_000);
      expect(cipher.decrypt(row.accessTokenCiphertext, row.id)).toBe(token);
      const newRefresh = cipher.decrypt(row.refreshTokenCiphertext, row.id);
      expect(newRefresh).toBe(fake.currentRefreshToken());
      expect(newRefresh).not.toBe(oldRefresh);
      // The fake rejects the previous (rotated-out) refresh token.
      const replay = await fake.postJson(`${AUTH}/oauth/token`, {
        grant_type: 'refresh_token',
        refresh_token: oldRefresh,
      });
      expect(replay.status).toBe(403);
      expect(await audits('jira_token_refreshed')).toHaveLength(1);
    });

    it('serializes parallel callers into exactly one refresh', async () => {
      const dto = await connect();
      await expire(dto.id);
      const before = tokenCalls();
      const tokens = await Promise.all(
        Array.from({ length: 10 }, () => service.getValidAccessToken(userA, dto.id)),
      );
      expect(tokenCalls()).toBe(before + 1);
      expect(new Set(tokens).size).toBe(1);
      expect(await audits('jira_token_refreshed')).toHaveLength(1);
    });

    it('marks reauthorization_required on invalid_grant and stops calling Atlassian', async () => {
      const dto = await connect();
      await expire(dto.id);
      fake.revokeAll();
      const error = await caught(service.getValidAccessToken(userA, dto.id));
      expect(error).toBeInstanceOf(ReauthorizationRequiredError);
      expectNoSecrets(error);
      expect((await service.listForUser(userA))[0]!.status).toBe('reauthorization_required');
      expect(await audits('jira_reauth_required')).toHaveLength(1);

      const before = fake.requests.length;
      await expect(service.getValidAccessToken(userA, dto.id)).rejects.toBeInstanceOf(
        ReauthorizationRequiredError,
      );
      expect(fake.requests).toHaveLength(before);
    });

    it.each([
      ['rate_limited', AtlassianRateLimitedError],
      ['server_error', AtlassianUnavailableError],
      ['network_error', AtlassianUnavailableError],
    ] as const)('keeps the connection active on transient %s', async (failure, errorType) => {
      const dto = await connect();
      await expire(dto.id);
      const refreshBefore = fake.currentRefreshToken();
      fake.failNext(failure);
      const error = await caught(service.getValidAccessToken(userA, dto.id));
      expect(error).toBeInstanceOf(errorType);
      expectNoSecrets(error);
      expect((await service.listForUser(userA))[0]!.status).toBe('active');
      expect(await audits('jira_reauth_required')).toHaveLength(0);
      // The stored refresh token is untouched, so the next attempt succeeds.
      expect(fake.currentRefreshToken()).toBe(refreshBefore);
      await expect(service.getValidAccessToken(userA, dto.id)).resolves.toMatch(/^access-/);
    });
  });

  describe('disconnect', () => {
    it('deletes the row, keeps the audit events and issues no Atlassian call', async () => {
      const dto = await connect();
      const before = fake.requests.length;
      await service.disconnect(userA, dto.id);
      expect(await prisma.jiraConnection.count()).toBe(0);
      expect(fake.requests).toHaveLength(before);
      const events = await audits('jira_disconnected');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ userId: userA, connectionId: null });
      expect(JSON.stringify(events[0]!.metadata)).not.toMatch(/access-|refresh-/);
      // The connect event survives with its connection reference cleared (ON DELETE SET NULL).
      expect(await audits('jira_connected')).toHaveLength(1);
      await expect(service.disconnect(userA, dto.id)).rejects.toBeInstanceOf(
        ConnectionNotFoundError,
      );
    });
  });
});
