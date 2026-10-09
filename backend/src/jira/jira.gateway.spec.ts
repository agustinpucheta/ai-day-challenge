import { Secret } from '../config/secret';
import { ApiTokenCredentialProvider } from './credentials/api-token-credential-provider';
import {
  JiraForbiddenError,
  JiraNotConfiguredError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';
import { JiraGateway } from './jira.gateway';
import type { HttpPort, HttpResult } from './oauth/http-port';

const URL_BASE = 'https://acme.atlassian.net';
const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-super-secret-token-value';
const EXPECTED_AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`;
const SECRETS = [TOKEN, EMAIL, EXPECTED_AUTH, Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')];

interface Call {
  url: string;
  headers: Record<string, string>;
}

/** Scripted HttpPort: returns the next queued result, or rejects when given an Error. */
class FakeHttp implements HttpPort {
  readonly calls: Call[] = [];
  constructor(private readonly next: HttpResult | Error) {}

  postJson(): Promise<HttpResult> {
    return Promise.reject(new Error('unexpected POST'));
  }

  getJson(url: string, headers: Record<string, string>): Promise<HttpResult> {
    this.calls.push({ url, headers });
    return this.next instanceof Error ? Promise.reject(this.next) : Promise.resolve(this.next);
  }
}

const ok = (body: unknown): HttpResult => ({ status: 200, headers: {}, body });
const status = (code: number, headers: Record<string, string> = {}): HttpResult => ({
  status: code,
  headers,
  body: { message: `remote body with ${TOKEN} and ${EMAIL}` },
});

function gatewayFor(next: HttpResult | Error, configured = true) {
  const http = new FakeHttp(next);
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

describe('JiraGateway.verifyConnection', () => {
  it('calls /myself with the exact Basic header and returns only site URL and display name', async () => {
    const { http, gateway } = gatewayFor(
      ok({ displayName: 'Ada Lovelace', emailAddress: EMAIL, accountId: 'abc', avatarUrls: {} }),
    );
    await expect(gateway.verifyConnection('user-1')).resolves.toEqual({
      siteUrl: URL_BASE,
      displayName: 'Ada Lovelace',
    });
    expect(http.calls).toEqual([
      { url: `${URL_BASE}/rest/api/3/myself`, headers: { authorization: EXPECTED_AUTH } },
    ]);
  });

  it('throws JiraNotConfiguredError without calling Jira when credentials are missing', async () => {
    const { http, gateway } = gatewayFor(ok({}), false);
    await expect(gateway.verifyConnection('user-1')).rejects.toBeInstanceOf(JiraNotConfiguredError);
    expect(http.calls).toHaveLength(0);
  });

  it.each([
    [401, JiraUnauthorizedError],
    [403, JiraForbiddenError],
    [500, JiraUnavailableError],
    [503, JiraUnavailableError],
    [404, JiraProtocolError],
    [302, JiraProtocolError],
  ])('maps HTTP %i to the typed error without leaking secrets', async (code, errorType) => {
    const { gateway } = gatewayFor(status(code));
    const error = await failureOf(gateway.verifyConnection('user-1'));
    expect(error).toBeInstanceOf(errorType);
    expect(leaks(error)).toEqual([]);
  });

  it('maps 429 to a rate-limit error carrying Retry-After', async () => {
    const { gateway } = gatewayFor(status(429, { 'retry-after': '42' }));
    const error = await failureOf(gateway.verifyConnection('user-1'));
    expect(error).toBeInstanceOf(JiraRateLimitedError);
    expect((error as JiraRateLimitedError).retryAfterSeconds).toBe(42);
    expect(leaks(error)).toEqual([]);

    const noHeader = await failureOf(gatewayFor(status(429)).gateway.verifyConnection('user-1'));
    expect((noHeader as JiraRateLimitedError).retryAfterSeconds).toBeUndefined();
  });

  it('treats network failures and timeouts as unavailable, dropping the cause', async () => {
    const cause = new Error(`connect ECONNREFUSED ${URL_BASE} with ${TOKEN}`);
    const { gateway } = gatewayFor(cause);
    const error = await failureOf(gateway.verifyConnection('user-1'));
    expect(error).toBeInstanceOf(JiraUnavailableError);
    expect(leaks(error)).toEqual([]);
    expect(error.cause).toBeUndefined();

    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const timedOut = await failureOf(gatewayFor(timeout).gateway.verifyConnection('user-1'));
    expect(timedOut).toBeInstanceOf(JiraUnavailableError);
  });

  it.each([
    ['an empty body', undefined],
    ['a non-object body', 'oops'],
    ['a missing displayName', { accountId: 'abc' }],
    ['an empty displayName', { displayName: '' }],
    ['a non-string displayName', { displayName: 7 }],
  ])('rejects %s as a protocol error', async (_label, body) => {
    const { gateway } = gatewayFor(ok(body));
    const error = await failureOf(gateway.verifyConnection('user-1'));
    expect(error).toBeInstanceOf(JiraProtocolError);
    expect(leaks(error)).toEqual([]);
  });
});
