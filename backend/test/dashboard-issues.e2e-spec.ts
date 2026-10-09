import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Secret } from '../src/config/secret';
import { ApiTokenCredentialProvider } from '../src/jira/credentials/api-token-credential-provider';
import { JIRA_CREDENTIAL_PROVIDER } from '../src/jira/credentials/jira-credential-provider';
import { HTTP_PORT, type HttpPort, type HttpResult } from '../src/jira/oauth/http-port';
import { API, TestContext, createTestApp, registerAndLogin } from './utils/test-app';
import { jiraFixture } from './utils/jira-fixtures';

const SITE = 'https://acme.atlassian.net';
const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-e2e-dashboard-secret-token';
const BASIC = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const SECRETS = [TOKEN, EMAIL, BASIC];

const SEARCH = `${API}/jira/issues/search`;
const ISSUE = `${API}/dashboard/issues`;

const ok = (body: unknown): HttpResult => ({ status: 200, headers: {}, body });
const failed = (status: number, headers: Record<string, string> = {}): HttpResult => ({
  status,
  headers,
  body: { errorMessages: [`remote detail with ${TOKEN} and ${EMAIL}`] },
});

/** Jira double behind the HttpPort. Never touches the network. */
class FakeJiraHttp implements HttpPort {
  readonly posts: Array<{ url: string; body: Record<string, unknown> }> = [];
  readonly gets: string[] = [];
  onPost: (body: Record<string, unknown>) => HttpResult | Error = () =>
    ok(jiraFixture('search-empty'));
  onGet: (url: string) => HttpResult | Error = () => failed(404);

  get callCount(): number {
    return this.posts.length + this.gets.length;
  }

  postJson(url: string, body: unknown): Promise<HttpResult> {
    const typed = body as Record<string, unknown>;
    this.posts.push({ url, body: typed });
    return settle(this.onPost(typed));
  }

  getJson(url: string): Promise<HttpResult> {
    this.gets.push(url);
    return settle(this.onGet(url));
  }
}

const keysOf = (items: unknown): string[] =>
  (items as Array<{ key: string }>).map((item) => item.key);

const settle = (value: HttpResult | Error): Promise<HttpResult> =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const configuredProvider = () =>
  new ApiTokenCredentialProvider({ url: SITE, username: EMAIL, token: new Secret(TOKEN) });

function expectNoSecrets(res: request.Response): void {
  const text = JSON.stringify(res.body) + res.text + JSON.stringify(res.headers);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
  expect(text.toLowerCase()).not.toContain('authorization');
}

describe('Jira issue search and dashboard issue (e2e)', () => {
  let ctx: TestContext;
  let jira: FakeJiraHttp;
  let agent: TestAgent;

  function post(index: number): { url: string; body: Record<string, unknown> } {
    const call = jira.posts[index];
    if (call === undefined) throw new Error(`no Jira POST #${index}`);
    return call;
  }

  async function start(provider: ApiTokenCredentialProvider = configuredProvider()) {
    jira = new FakeJiraHttp();
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(JIRA_CREDENTIAL_PROVIDER)
        .useValue(provider)
        .overrideProvider(HTTP_PORT)
        .useValue(jira),
    );
    agent = await registerAndLogin(ctx, 'dashboard@example.com');
  }

  afterEach(async () => {
    await ctx.close();
  });

  describe('authentication', () => {
    it('requires a session on both endpoints without calling Jira', async () => {
      await start();
      const anonymous = ctx.agent();
      const search = await anonymous.get(`${SEARCH}?q=abc`).expect(401);
      expect(search.body.code).toBe('UNAUTHENTICATED');
      const issue = await anonymous.get(`${ISSUE}/DEMO-2`).expect(401);
      expect(issue.body.code).toBe('UNAUTHENTICATED');
      expect(jira.callCount).toBe(0);
    });
  });

  describe('GET /jira/issues/search', () => {
    it('searches by text with the default page size and maps the summaries', async () => {
      await start();
      jira.onPost = () => ok(jiraFixture('search-page-1'));
      const res = await agent.get(`${SEARCH}?q=%20demo%20epic%20`).expect(200);
      expect(keysOf(res.body.items)).toEqual(['DEMO-1', 'DEMO-8']);
      expect(res.body.items[0]).toEqual({
        key: 'DEMO-1',
        summary: 'Demo epic',
        issueType: { id: '10000', name: 'Epic', hierarchyLevel: 1, isSubtask: false },
        status: { name: 'In progress', categoryKey: 'indeterminate', isCancelled: false },
        url: `${SITE}/browse/DEMO-1`,
      });
      expect(res.body.nextPageToken).toBe('opaque-token-page-2');
      expect(res.body.metadata).toEqual({ fetchedAt: expect.any(String), isStale: false });
      expect(jira.posts).toHaveLength(1);
      expect(post(0).url).toBe(`${SITE}/rest/api/3/search/jql`);
      expect(post(0).body).toMatchObject({
        jql: 'text ~ "demo epic" ORDER BY updated DESC',
        maxResults: 20,
      });
      expectNoSecrets(res);
    });

    it('searches by issue key', async () => {
      await start();
      jira.onPost = () => ok(jiraFixture('search-last-page'));
      await agent.get(`${SEARCH}?q=demo-12&pageSize=5`).expect(200);
      expect(post(0).body).toMatchObject({
        jql: 'key = "DEMO-12" ORDER BY updated DESC',
        maxResults: 5,
      });
    });

    it('walks page 1, page 2 and the last page (nextPageToken null)', async () => {
      await start();
      jira.onPost = (body) =>
        body.nextPageToken === 'opaque-token-page-2'
          ? ok(jiraFixture('search-last-page'))
          : ok(jiraFixture('search-page-1'));
      const first = await agent.get(`${SEARCH}?q=demo`).expect(200);
      expect(first.body.nextPageToken).toBe('opaque-token-page-2');
      const second = await agent
        .get(`${SEARCH}?q=demo&pageToken=${first.body.nextPageToken as string}`)
        .expect(200);
      expect(keysOf(second.body.items)).toEqual(['DEMO-12']);
      expect(second.body.nextPageToken).toBeNull();
      expect(post(1).body.nextPageToken).toBe('opaque-token-page-2');
    });

    it('returns a legitimately empty 200 only when Jira answered 200 with no issues', async () => {
      await start();
      const res = await agent.get(`${SEARCH}?q=nothing`).expect(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.nextPageToken).toBeNull();
    });

    it.each([
      ['401', failed(401), 424, 'JIRA_REAUTH_REQUIRED'],
      ['403', failed(403), 424, 'JIRA_FORBIDDEN'],
      ['429', failed(429, { 'retry-after': '30' }), 429, 'JIRA_RATE_LIMITED'],
      ['400', failed(400), 503, 'JIRA_UNAVAILABLE'],
      ['500', failed(500), 503, 'JIRA_UNAVAILABLE'],
      ['502', failed(502), 503, 'JIRA_UNAVAILABLE'],
      ['a malformed body', ok({ unexpected: true }), 503, 'JIRA_UNAVAILABLE'],
      [
        'a malformed issue',
        ok({ issues: [jiraFixture('malformed-issue')], isLast: true }),
        503,
        'JIRA_UNAVAILABLE',
      ],
      ['a network error', new Error(`ECONNRESET ${TOKEN}`), 503, 'JIRA_UNAVAILABLE'],
    ])('answers the error status, never an empty list, on %s', async (_l, result, status, code) => {
      await start();
      jira.onPost = () => result;
      const res = await agent.get(`${SEARCH}?q=abc`).expect(status);
      expect(res.body.code).toBe(code);
      expect(res.body).not.toHaveProperty('items');
      if (status === 429) expect(res.headers['retry-after']).toBe('30');
      expectNoSecrets(res);
    });

    it('answers JIRA_NOT_CONNECTED (409) when credentials are not configured', async () => {
      await start(new ApiTokenCredentialProvider(null));
      const res = await agent.get(`${SEARCH}?q=abc`).expect(409);
      expect(res.body.code).toBe('JIRA_NOT_CONNECTED');
      expect(jira.callCount).toBe(0);
    });

    it.each([
      ['missing q', ''],
      ['q too short', '?q=a'],
      ['q with a control character', '?q=ab%00cd'],
      ['q too long', `?q=${'x'.repeat(101)}`],
      ['invalid pageSize', '?q=abc&pageSize=51'],
      ['non numeric pageSize', '?q=abc&pageSize=ten'],
      ['invalid pageToken', '?q=abc&pageToken=a%20b'],
      ['oversized pageToken', `?q=abc&pageToken=${'a'.repeat(2001)}`],
      ['unknown parameter (userId)', '?q=abc&userId=someone-else'],
    ])('answers 400 VALIDATION_ERROR without calling Jira on %s', async (_l, query) => {
      await start();
      const res = await agent.get(`${SEARCH}${query}`).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(jira.callCount).toBe(0);
    });
  });

  describe('GET /dashboard/issues/:issueKey', () => {
    it('returns the issue with subtasks and both story point values', async () => {
      await start();
      jira.onGet = () => ok(jiraFixture('story-with-subtasks'));
      const res = await agent.get(`${ISSUE}/demo-2`).expect(200);
      expect(res.body.issue).toMatchObject({
        id: '2',
        key: 'DEMO-2',
        summary: 'Story with subtasks',
        parentKey: 'DEMO-1',
        storyPoints: { final: 8, planned: 13 },
        url: `${SITE}/browse/DEMO-2`,
      });
      expect(keysOf(res.body.subtasks)).toEqual(['DEMO-3', 'DEMO-4', 'DEMO-5']);
      expect(res.body.subtasks[1].status).toMatchObject({ categoryKey: 'done', isCancelled: true });
      expect(res.body.metadata).toEqual({
        fetchedAt: expect.any(String),
        isStale: false,
        warnings: [],
      });
      expect(res.body).not.toHaveProperty('progress');
      expect(jira.gets).toHaveLength(1);
      expect(jira.gets[0]).toContain(`${SITE}/rest/api/3/issue/DEMO-2?fields=`);
      expectNoSecrets(res);
    });

    it('keeps missing story points as null', async () => {
      await start();
      jira.onGet = () => ok(jiraFixture('task-no-subtasks'));
      const res = await agent.get(`${ISSUE}/DEMO-8`).expect(200);
      expect(res.body.issue.storyPoints).toEqual({ final: null, planned: null });
      expect(res.body.issue.parentKey).toBeNull();
      expect(res.body.subtasks).toEqual([]);
    });

    it('answers the same 404 for a missing and a forbidden issue, byte for byte', async () => {
      await start();
      jira.onGet = () => failed(404);
      const missing = await agent.get(`${ISSUE}/DEMO-404`).expect(404);
      jira.onGet = () => failed(403);
      const forbidden = await agent.get(`${ISSUE}/DEMO-404`).expect(404);
      expect(missing.body).toEqual({
        code: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE',
        message: 'The issue does not exist or is not accessible',
      });
      expect(forbidden.text).toBe(missing.text);
      const stable = (res: request.Response) => {
        return Object.fromEntries(Object.entries(res.headers).filter(([name]) => name !== 'date'));
      };
      expect(stable(forbidden)).toEqual(stable(missing));
      expect(forbidden.status).toBe(missing.status);
    });

    it.each([
      ['not a key', 'hello'],
      ['no number', 'DEMO-'],
      ['too short project', 'A-1'],
      ['path-like', '..%2Fadmin'],
    ])('answers 400 VALIDATION_ERROR without calling Jira on %s', async (_l, key) => {
      await start();
      const res = await agent.get(`${ISSUE}/${key}`).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(jira.callCount).toBe(0);
    });

    it('answers JIRA_NOT_CONNECTED (409) when credentials are not configured', async () => {
      await start(new ApiTokenCredentialProvider(null));
      const res = await agent.get(`${ISSUE}/DEMO-2`).expect(409);
      expect(res.body.code).toBe('JIRA_NOT_CONNECTED');
      expect(jira.callCount).toBe(0);
    });

    it.each([
      ['401', failed(401), 424, 'JIRA_REAUTH_REQUIRED'],
      ['429', failed(429, { 'retry-after': '7' }), 429, 'JIRA_RATE_LIMITED'],
      ['500', failed(500), 503, 'JIRA_UNAVAILABLE'],
      ['a malformed issue', ok(jiraFixture('malformed-issue')), 503, 'JIRA_UNAVAILABLE'],
      ['a network error', new Error(`ECONNRESET ${TOKEN}`), 503, 'JIRA_UNAVAILABLE'],
    ])('maps %s to the Jira error code', async (_l, result, status, code) => {
      await start();
      jira.onGet = () => result;
      const res = await agent.get(`${ISSUE}/DEMO-2`).expect(status);
      expect(res.body.code).toBe(code);
      expectNoSecrets(res);
    });
  });
});
