import { FakeAtlassian } from '../../../test/utils/fake-atlassian';
import {
  AtlassianInvalidGrantError,
  AtlassianProtocolError,
  AtlassianRateLimitedError,
  AtlassianUnavailableError,
  JiraOAuthNotConfiguredError,
} from './atlassian-errors';
import { AtlassianOAuthClient, type AtlassianOAuthSettings } from './atlassian-oauth.client';

const SECRET = 'super-secret-client-value';
const SETTINGS: AtlassianOAuthSettings = {
  clientId: 'client-123',
  clientSecret: SECRET,
  redirectUri: 'http://localhost:3000/api/v1/jira/oauth/callback',
  scopes: 'read:jira-work write:jira-work offline_access',
  authBaseUrl: 'https://auth.atlassian.test',
  apiBaseUrl: 'https://api.atlassian.test',
};
const NOW = new Date('2026-01-01T00:00:00.000Z');

function setup() {
  const fake = new FakeAtlassian();
  const client = new AtlassianOAuthClient(SETTINGS, fake, () => NOW);
  return { fake, client };
}

/** Everything an error could leak: message, serialized form and stack. */
function leaks(error: unknown, secrets: string[]): string[] {
  const text = [
    (error as Error).message,
    JSON.stringify(error),
    String((error as Error).stack),
  ].join('\n');
  return secrets.filter((secret) => text.includes(secret));
}

describe('AtlassianOAuthClient', () => {
  it('builds the authorize URL with exactly the expected parameters', () => {
    const { client } = setup();
    const url = new URL(client.buildAuthorizeUrl('state-abc'));
    expect(url.origin + url.pathname).toBe('https://auth.atlassian.test/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      audience: 'api.atlassian.com',
      client_id: 'client-123',
      scope: 'read:jira-work write:jira-work offline_access',
      redirect_uri: SETTINGS.redirectUri,
      state: 'state-abc',
      response_type: 'code',
      prompt: 'consent',
    });
    expect(url.toString()).not.toContain(SECRET);
  });

  it('exchanges a code for tokens, expiry and scopes', async () => {
    const { fake, client } = setup();
    const result = await client.exchangeCode(fake.issueCode());
    expect(result).toEqual({
      accessToken: expect.stringMatching(/^access-/),
      refreshToken: expect.stringMatching(/^refresh-/),
      expiresAt: new Date(NOW.getTime() + 3600_000),
      scopes: ['read:jira-work', 'offline_access'],
    });
    expect(fake.requests[0]?.body).toMatchObject({
      grant_type: 'authorization_code',
      client_id: 'client-123',
      redirect_uri: SETTINGS.redirectUri,
    });
  });

  it('returns the rotated refresh token and invalidates the previous one', async () => {
    const { fake, client } = setup();
    const first = await client.exchangeCode(fake.issueCode());
    const second = await client.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(fake.currentRefreshToken()).toBe(second.refreshToken);
    await expect(client.refresh(first.refreshToken)).rejects.toBeInstanceOf(
      AtlassianInvalidGrantError,
    );
  });

  it('lists accessible resources', async () => {
    const { fake, client } = setup();
    const { accessToken } = await client.exchangeCode(fake.issueCode());
    await expect(client.listAccessibleResources(accessToken)).resolves.toEqual([
      {
        cloudId: 'cloud-1',
        name: 'Acme',
        url: 'https://acme.atlassian.net',
        scopes: ['read:jira-work'],
      },
    ]);
    expect(fake.requests.at(-1)?.headers).toMatchObject({
      Authorization: `Bearer ${accessToken}`,
    });
  });

  it('maps an unknown code and a revoked refresh token to invalid_grant', async () => {
    const { fake, client } = setup();
    await expect(client.exchangeCode('bad-code')).rejects.toBeInstanceOf(
      AtlassianInvalidGrantError,
    );
    const { refreshToken } = await client.exchangeCode(fake.issueCode());
    fake.revokeAll();
    await expect(client.refresh(refreshToken)).rejects.toBeInstanceOf(AtlassianInvalidGrantError);
  });

  it('maps 429 to a rate-limit error with retryAfter', async () => {
    const { fake, client } = setup();
    fake.failNext('rate_limited');
    await expect(client.refresh('r')).rejects.toMatchObject({
      name: 'AtlassianRateLimitedError',
      retryAfterSeconds: 7,
    });
    fake.failNext('rate_limited');
    await expect(client.refresh('r')).rejects.toBeInstanceOf(AtlassianRateLimitedError);
  });

  it.each(['server_error', 'network_error'] as const)('maps %s to unavailable', async (kind) => {
    const { fake, client } = setup();
    fake.failNext(kind);
    await expect(client.exchangeCode('c')).rejects.toBeInstanceOf(AtlassianUnavailableError);
  });

  it('maps a malformed body to a protocol error for every call', async () => {
    const { fake, client } = setup();
    fake.failNext('malformed', 3);
    await expect(client.exchangeCode('c')).rejects.toBeInstanceOf(AtlassianProtocolError);
    await expect(client.refresh('r')).rejects.toBeInstanceOf(AtlassianProtocolError);
    await expect(client.listAccessibleResources('a')).rejects.toBeInstanceOf(
      AtlassianProtocolError,
    );
  });

  it('never leaks secrets, tokens or codes in errors', async () => {
    const { fake, client } = setup();
    const code = 'code-secret-value';
    const refresh = 'refresh-secret-value';
    const failures = ['invalid_grant', 'rate_limited', 'server_error', 'malformed'] as const;
    for (const kind of failures) {
      fake.failNext(kind, 2);
      const errors = await Promise.all([
        client.exchangeCode(code).catch((error: unknown) => error),
        client.refresh(refresh).catch((error: unknown) => error),
      ]);
      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
        expect(leaks(error, [SECRET, code, refresh])).toEqual([]);
      }
    }
    fake.failNext('network_error');
    const error = await client.exchangeCode(code).catch((e: unknown) => e);
    expect(leaks(error, [SECRET, code])).toEqual([]);
  });

  it('throws a typed error when OAuth is not configured', async () => {
    const client = new AtlassianOAuthClient(null, new FakeAtlassian());
    expect(() => client.buildAuthorizeUrl('s')).toThrow(JiraOAuthNotConfiguredError);
    await expect(client.exchangeCode('c')).rejects.toBeInstanceOf(JiraOAuthNotConfiguredError);
    await expect(client.refresh('r')).rejects.toBeInstanceOf(JiraOAuthNotConfiguredError);
    await expect(client.listAccessibleResources('a')).rejects.toBeInstanceOf(
      JiraOAuthNotConfiguredError,
    );
  });
});
