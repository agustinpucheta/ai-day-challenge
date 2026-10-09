import { jiraFixture } from '../../test/utils/jira-fixtures';
import { Secret } from '../config/secret';
import { ApiTokenCredentialProvider } from './credentials/api-token-credential-provider';
import {
  JiraBadRequestError,
  JiraForbiddenError,
  JiraInvalidQueryError,
  JiraIssueNotFoundError,
  JiraNotConfiguredError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';
import { JiraGateway } from './jira.gateway';
import { JIRA_ISSUE_FIELDS } from './jira.config';
import type { HttpPort, HttpResult } from './oauth/http-port';

const URL_BASE = 'https://acme.atlassian.net';
const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-super-secret-token-value';
const BASIC = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const SECRETS = [TOKEN, EMAIL, BASIC, `Basic ${BASIC}`];

interface Call {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string> | undefined;
  body?: unknown;
}

/** Scripted HttpPort: each call consumes the next queued result (or rejects on an Error). */
class FakeHttp implements HttpPort {
  readonly calls: Call[] = [];
  constructor(private readonly queue: Array<HttpResult | Error>) {}

  postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<HttpResult> {
    this.calls.push({ method: 'POST', url, headers, body });
    return this.next();
  }

  getJson(url: string, headers: Record<string, string>): Promise<HttpResult> {
    this.calls.push({ method: 'GET', url, headers });
    return this.next();
  }

  private next(): Promise<HttpResult> {
    const item = this.queue.shift();
    if (item === undefined) return Promise.reject(new Error('no scripted response'));
    return item instanceof Error ? Promise.reject(item) : Promise.resolve(item);
  }
}

const ok = (body: unknown): HttpResult => ({ status: 200, headers: {}, body });
const failed = (code: number, headers: Record<string, string> = {}): HttpResult => ({
  status: code,
  headers,
  body: { errorMessages: [`remote detail with ${TOKEN} and ${EMAIL}`] },
});

function setup(queue: Array<HttpResult | Error>, configured = true) {
  const http = new FakeHttp(queue);
  const provider = new ApiTokenCredentialProvider(
    configured ? { url: URL_BASE, username: EMAIL, token: new Secret(TOKEN) } : null,
  );
  return { http, gateway: new JiraGateway(provider, http) };
}

async function failureOf(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected the call to fail');
}

function leaks(error: Error): string[] {
  const text = [error.message, String(error), JSON.stringify(error), String(error.stack)].join(
    '\n',
  );
  return SECRETS.filter((secret) => text.includes(secret));
}

const FAILURES: Array<[string, HttpResult | Error, new (...args: never[]) => Error]> = [
  ['400', failed(400), JiraBadRequestError],
  ['401', failed(401), JiraUnauthorizedError],
  ['429', failed(429, { 'retry-after': '5' }), JiraRateLimitedError],
  ['500', failed(500), JiraUnavailableError],
  ['503', failed(503), JiraUnavailableError],
  ['network error', new Error(`ECONNRESET ${TOKEN}`), JiraUnavailableError],
  ['malformed payload', ok({ unexpected: true }), JiraProtocolError],
  ['empty body', ok(undefined), JiraProtocolError],
  [
    'malformed issue in page',
    ok({ issues: [jiraFixture('malformed-issue')], isLast: true }),
    JiraProtocolError,
  ],
];

describe('JiraGateway.searchIssues', () => {
  it('POSTs the enhanced search with auth headers, fields and the default page size', async () => {
    const { http, gateway } = setup([ok(jiraFixture('search-empty'))]);
    await gateway.searchIssues('u1', { query: 'DEMO-8' });
    expect(http.calls).toEqual([
      {
        method: 'POST',
        url: `${URL_BASE}/rest/api/3/search/jql`,
        headers: { authorization: `Basic ${BASIC}` },
        body: {
          jql: 'key = "DEMO-8" ORDER BY updated DESC',
          fields: JIRA_ISSUE_FIELDS,
          maxResults: 20,
        },
      },
    ]);
  });

  it('paginates with the opaque token: page 1, token, last page', async () => {
    const { http, gateway } = setup([
      ok(jiraFixture('search-page-1')),
      ok(jiraFixture('search-last-page')),
    ]);
    const first = await gateway.searchIssues('u1', { query: 'demo', pageSize: 2 });
    expect(first.issues.map((i) => i.key)).toEqual(['DEMO-1', 'DEMO-8']);
    expect(first.nextPageToken).toBe('opaque-token-page-2');
    expect(first.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const second = await gateway.searchIssues('u1', {
      query: 'demo',
      pageSize: 2,
      pageToken: first.nextPageToken ?? undefined,
    });
    expect(second.issues.map((i) => i.key)).toEqual(['DEMO-12']);
    expect(second.nextPageToken).toBeNull();
    expect(http.calls[0]?.body).not.toHaveProperty('nextPageToken');
    expect(http.calls[1]?.body).toMatchObject({
      maxResults: 2,
      nextPageToken: 'opaque-token-page-2',
    });
  });

  it('returns an empty page only for a successful 200', async () => {
    const { gateway } = setup([ok(jiraFixture('search-empty'))]);
    await expect(gateway.searchIssues('u1', { query: 'nothing' })).resolves.toMatchObject({
      issues: [],
      nextPageToken: null,
    });
  });

  it.each(FAILURES)('throws a typed error (never an empty page) on %s', async (_l, next, type) => {
    const { gateway } = setup([next]);
    const error = await failureOf(gateway.searchIssues('u1', { query: 'demo' }));
    expect(error).toBeInstanceOf(type);
    expect(leaks(error)).toEqual([]);
  });

  it('maps 403 on search to the forbidden error', async () => {
    const error = await failureOf(setup([failed(403)]).gateway.searchIssues('u1', { query: 'a' }));
    expect(error).toBeInstanceOf(JiraForbiddenError);
  });

  it('refuses a non-final page that carries no continuation token', async () => {
    const { gateway } = setup([ok({ issues: [], isLast: false })]);
    await expect(gateway.searchIssues('u1', { query: 'a' })).rejects.toBeInstanceOf(
      JiraProtocolError,
    );
  });

  it.each([
    [{ query: '' }],
    [{ query: 'a', pageSize: 0 }],
    [{ query: 'a', pageSize: 51 }],
    [{ query: 'a', pageSize: 1.5 }],
    [{ query: 'a', pageToken: '' }],
    [{ query: 'a', pageToken: 'x'.repeat(5000) }],
    [{ query: 'a', issueTypeIds: ['Story'] }],
  ])('rejects invalid input %j without any HTTP call', async (input) => {
    const { http, gateway } = setup([]);
    await expect(gateway.searchIssues('u1', input)).rejects.toBeInstanceOf(JiraInvalidQueryError);
    expect(http.calls).toHaveLength(0);
  });

  it('accepts the maximum page size and fails when credentials are missing', async () => {
    const ready = setup([ok(jiraFixture('search-empty'))]);
    await ready.gateway.searchIssues('u1', { query: 'a', pageSize: 50 });
    expect(ready.http.calls[0]?.body).toMatchObject({ maxResults: 50 });

    const missing = setup([], false);
    await expect(missing.gateway.searchIssues('u1', { query: 'a' })).rejects.toBeInstanceOf(
      JiraNotConfiguredError,
    );
    expect(missing.http.calls).toHaveLength(0);
  });
});

describe('JiraGateway.getIssue', () => {
  it('GETs the issue with the requested fields and returns the normalized issue', async () => {
    const { http, gateway } = setup([ok(jiraFixture('story-with-subtasks'))]);
    const result = await gateway.getIssue('u1', 'demo-2');
    expect(result.issue).toMatchObject({
      key: 'DEMO-2',
      url: `${URL_BASE}/browse/DEMO-2`,
      storyPoints: { final: 8, planned: 13 },
    });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(http.calls).toEqual([
      {
        method: 'GET',
        url: `${URL_BASE}/rest/api/3/issue/DEMO-2?fields=${encodeURIComponent(JIRA_ISSUE_FIELDS.join(','))}`,
        headers: { authorization: `Basic ${BASIC}` },
      },
    ]);
  });

  it.each([
    ['DEMO-1/../../myself'],
    ['DEMO-1?expand=x'],
    ['../x'],
    ['DEMO'],
    ['1-2'],
    [''],
    ['DEMO-1\n'],
  ])('rejects the invalid key %p before any HTTP call', async (key) => {
    const { http, gateway } = setup([]);
    await expect(gateway.getIssue('u1', key)).rejects.toBeInstanceOf(JiraInvalidQueryError);
    expect(http.calls).toHaveLength(0);
  });

  it('answers 403 and 404 with the same error, hiding the real status from callers', async () => {
    const forbidden = await failureOf(setup([failed(403)]).gateway.getIssue('u1', 'DEMO-9'));
    const missing = await failureOf(setup([failed(404)]).gateway.getIssue('u1', 'DEMO-9'));
    for (const error of [forbidden, missing]) {
      expect(error).toBeInstanceOf(JiraIssueNotFoundError);
      expect(error.message).toBe('Issue not found');
      expect(JSON.stringify(error)).toBe('{"name":"JiraIssueNotFoundError"}');
      expect(leaks(error)).toEqual([]);
    }
    expect(JSON.stringify(forbidden)).toBe(JSON.stringify(missing));
    expect((forbidden as JiraIssueNotFoundError).upstreamStatus).toBe(403);
    expect((missing as JiraIssueNotFoundError).upstreamStatus).toBe(404);
  });

  it.each(FAILURES.filter(([label]) => label !== 'malformed issue in page'))(
    'throws a typed error on %s',
    async (_l, next, type) => {
      const error = await failureOf(setup([next]).gateway.getIssue('u1', 'DEMO-9'));
      expect(error).toBeInstanceOf(type);
      expect(leaks(error)).toEqual([]);
    },
  );

  it('rejects a malformed issue payload as a protocol error', async () => {
    const { gateway } = setup([ok(jiraFixture('malformed-issue'))]);
    await expect(gateway.getIssue('u1', 'DEMO-99')).rejects.toBeInstanceOf(JiraProtocolError);
  });

  it('exposes no secrets and no cause when the network fails', async () => {
    const error = await failureOf(
      setup([new Error(`boom ${TOKEN}`)]).gateway.getIssue('u1', 'DEMO-9'),
    );
    expect(error.cause).toBeUndefined();
    expect(leaks(error)).toEqual([]);
  });
});
