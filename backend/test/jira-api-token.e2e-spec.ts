import request from 'supertest';
import { Secret } from '../src/config/secret';
import { ApiTokenCredentialProvider } from '../src/jira/credentials/api-token-credential-provider';
import { JIRA_CREDENTIAL_PROVIDER } from '../src/jira/credentials/jira-credential-provider';
import { HTTP_PORT, type HttpPort, type HttpResult } from '../src/jira/oauth/http-port';
import { API, TestContext, createTestApp, registerAndLogin } from './utils/test-app';

const SITE = 'https://acme.atlassian.net';
const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-e2e-super-secret-token';
const BASIC = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const SECRETS = [TOKEN, EMAIL, BASIC];

/** Jira double behind the HttpPort. Never touches the network. */
class FakeJiraHttp implements HttpPort {
  readonly calls: Array<{ url: string; headers: Record<string, string> }> = [];
  result: HttpResult = { status: 200, headers: {}, body: { displayName: 'Ada Lovelace' } };

  postJson(): Promise<HttpResult> {
    return Promise.reject(new Error('unexpected POST'));
  }

  getJson(url: string, headers: Record<string, string>): Promise<HttpResult> {
    this.calls.push({ url, headers });
    return Promise.resolve(this.result);
  }
}

const configuredProvider = () =>
  new ApiTokenCredentialProvider({ url: SITE, username: EMAIL, token: new Secret(TOKEN) });

function expectNoSecrets(res: request.Response): void {
  const text = JSON.stringify(res.body) + res.text + JSON.stringify(res.headers);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
}

describe('Jira API token connection (e2e)', () => {
  let ctx: TestContext;
  let jira: FakeJiraHttp;

  async function start(provider: ApiTokenCredentialProvider) {
    jira = new FakeJiraHttp();
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(JIRA_CREDENTIAL_PROVIDER)
        .useValue(provider)
        .overrideProvider(HTTP_PORT)
        .useValue(jira),
    );
    return registerAndLogin(ctx, 'owner-local@example.com');
  }

  afterEach(async () => {
    await ctx.close();
  });

  it('requires a session on both endpoints', async () => {
    await start(configuredProvider());
    const anonymous = ctx.agent();
    const get = await anonymous.get(`${API}/jira/connection`).expect(401);
    expect(get.body.code).toBe('UNAUTHENTICATED');
    const post = await anonymous.post(`${API}/jira/connection/verify`).expect(401);
    expect(post.body.code).toBe('UNAUTHENTICATED');
    expect(jira.calls).toHaveLength(0);
  });

  it('rejects a foreign Origin on verify', async () => {
    const agent = await start(configuredProvider());
    await agent
      .post(`${API}/jira/connection/verify`)
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(jira.calls).toHaveLength(0);
  });

  it('reports not_configured without any network call', async () => {
    const agent = await start(new ApiTokenCredentialProvider(null));
    const res = await agent.get(`${API}/jira/connection`).expect(200);
    expect(res.body).toEqual({ mode: 'api_token', status: 'not_configured', siteUrl: null });
    expect(jira.calls).toHaveLength(0);
  });

  it('reports configured with the site URL, without secrets or network calls', async () => {
    const agent = await start(configuredProvider());
    const res = await agent.get(`${API}/jira/connection`).expect(200);
    expect(res.body).toEqual({ mode: 'api_token', status: 'configured', siteUrl: SITE });
    expect(jira.calls).toHaveLength(0);
    expectNoSecrets(res);
  });

  it('verifies the connection and returns only site, display name and check time', async () => {
    const agent = await start(configuredProvider());
    jira.result = {
      status: 200,
      headers: {},
      body: { displayName: 'Ada Lovelace', emailAddress: EMAIL, accountId: 'abc-123' },
    };
    const res = await agent.post(`${API}/jira/connection/verify`).expect(200);
    expect(res.body).toEqual({
      status: 'connected',
      siteUrl: SITE,
      displayName: 'Ada Lovelace',
      checkedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(res.body.checkedAt as string))).toBe(false);
    expectNoSecrets(res);
    expect(jira.calls).toEqual([
      { url: `${SITE}/rest/api/3/myself`, headers: { authorization: `Basic ${BASIC}` } },
    ]);
  });

  it('answers JIRA_NOT_CONNECTED (409) when credentials are not configured', async () => {
    const agent = await start(new ApiTokenCredentialProvider(null));
    const res = await agent.post(`${API}/jira/connection/verify`).expect(409);
    expect(res.body.code).toBe('JIRA_NOT_CONNECTED');
    expect(jira.calls).toHaveLength(0);
  });

  it('answers JIRA_REAUTH_REQUIRED with 424, never 401, when Jira rejects the token', async () => {
    const agent = await start(configuredProvider());
    jira.result = { status: 401, headers: {}, body: { message: `bad ${TOKEN}` } };
    const res = await agent.post(`${API}/jira/connection/verify`).expect(424);
    expect(res.body.code).toBe('JIRA_REAUTH_REQUIRED');
    expect(res.body.message).toContain('JIRA_API_TOKEN');
    expectNoSecrets(res);
    // The app session is untouched: the user is still logged in.
    await agent.get(`${API}/auth/me`).expect(200);
  });

  it('answers JIRA_FORBIDDEN with 424 when Jira denies the account', async () => {
    const agent = await start(configuredProvider());
    jira.result = { status: 403, headers: {}, body: undefined };
    const res = await agent.post(`${API}/jira/connection/verify`).expect(424);
    expect(res.body.code).toBe('JIRA_FORBIDDEN');
  });

  it('answers JIRA_RATE_LIMITED with 429 and the Retry-After header', async () => {
    const agent = await start(configuredProvider());
    jira.result = { status: 429, headers: { 'retry-after': '30' }, body: undefined };
    const res = await agent.post(`${API}/jira/connection/verify`).expect(429);
    expect(res.body.code).toBe('JIRA_RATE_LIMITED');
    expect(res.headers['retry-after']).toBe('30');
  });

  it.each([
    ['a 5xx', { status: 502, headers: {}, body: undefined }],
    ['an unexpected body', { status: 200, headers: {}, body: { unexpected: true } }],
  ])('answers JIRA_UNAVAILABLE (503) on %s', async (_label, result) => {
    const agent = await start(configuredProvider());
    jira.result = result;
    const res = await agent.post(`${API}/jira/connection/verify`).expect(503);
    expect(res.body.code).toBe('JIRA_UNAVAILABLE');
    expectNoSecrets(res);
  });

  it('answers JIRA_UNAVAILABLE when the network call fails', async () => {
    const agent = await start(configuredProvider());
    jira.getJson = () => Promise.reject(new Error(`ECONNRESET while sending ${TOKEN}`));
    const res = await agent.post(`${API}/jira/connection/verify`).expect(503);
    expect(res.body.code).toBe('JIRA_UNAVAILABLE');
    expectNoSecrets(res);
  });
});

describe('Jira API token with the default wiring (e2e)', () => {
  let ctx: TestContext;

  afterEach(async () => {
    await ctx.close();
  });

  it('is not configured when the variables are empty (as with `JIRA_URL=` in .env)', async () => {
    ctx = await createTestApp();
    const agent = await registerAndLogin(ctx, 'env-unset@example.com');
    const status = await agent.get(`${API}/jira/connection`).expect(200);
    expect(status.body).toEqual({ mode: 'api_token', status: 'not_configured', siteUrl: null });
    const verify = await agent.post(`${API}/jira/connection/verify`).expect(409);
    expect(verify.body.code).toBe('JIRA_NOT_CONNECTED');
  });
});
