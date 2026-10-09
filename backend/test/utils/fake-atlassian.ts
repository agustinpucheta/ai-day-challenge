import type { HttpPort, HttpResult } from '../../src/jira/oauth/http-port';

/**
 * In-memory Atlassian OAuth 3LO double implementing the `HttpPort`. Never touches the network.
 *
 * Happy path: `issueCode()` -> client `exchangeCode(code)` -> `refresh(token)` rotates the
 * refresh token (the previous one stops working, like Atlassian's rotating tokens).
 *
 * Programmable failures: `failNext('invalid_grant' | 'rate_limited' | 'server_error' |
 * 'malformed' | 'network_error', times)` makes the next token/resources calls fail that way.
 * `requests` records every call so tests can assert on what was sent (never log it).
 */
export type FakeFailure =
  'invalid_grant' | 'rate_limited' | 'server_error' | 'malformed' | 'network_error';

export interface FakeResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
}

export interface RecordedRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeAtlassianOptions {
  authBaseUrl?: string;
  apiBaseUrl?: string;
  scope?: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
}

export class FakeAtlassian implements HttpPort {
  readonly requests: RecordedRequest[] = [];
  resources: FakeResource[] = [
    {
      id: 'cloud-1',
      name: 'Acme',
      url: 'https://acme.atlassian.net',
      scopes: ['read:jira-work'],
      avatarUrl: 'https://example.invalid/a.png',
    },
  ];

  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly scope: string;
  private readonly expiresIn: number;
  private readonly retryAfter: number;
  private readonly codes = new Set<string>();
  private readonly accessTokens = new Set<string>();
  private validRefreshToken: string | undefined;
  private failures: FakeFailure[] = [];
  private counter = 0;

  constructor(options: FakeAtlassianOptions = {}) {
    this.authBaseUrl = options.authBaseUrl ?? 'https://auth.atlassian.test';
    this.apiBaseUrl = options.apiBaseUrl ?? 'https://api.atlassian.test';
    this.scope = options.scope ?? 'read:jira-work offline_access';
    this.expiresIn = options.expiresInSeconds ?? 3600;
    this.retryAfter = options.retryAfterSeconds ?? 7;
  }

  /** Registers a one-time authorization code that `exchangeCode` accepts. */
  issueCode(): string {
    const code = `code-${++this.counter}`;
    this.codes.add(code);
    return code;
  }

  /** Makes the next `times` calls to the token or resources endpoints fail. */
  failNext(failure: FakeFailure, times = 1): void {
    this.failures = Array.from({ length: times }, () => failure);
  }

  /** The only refresh token currently accepted, or undefined before any exchange. */
  currentRefreshToken(): string | undefined {
    return this.validRefreshToken;
  }

  /** Simulates the user revoking the app: every token stops working. */
  revokeAll(): void {
    this.validRefreshToken = undefined;
    this.accessTokens.clear();
  }

  postJson(url: string, body: unknown): Promise<HttpResult> {
    this.requests.push({ method: 'POST', url, headers: {}, body });
    return this.respond(() => this.handleToken(url, body));
  }

  getJson(url: string, headers: Record<string, string>): Promise<HttpResult> {
    this.requests.push({ method: 'GET', url, headers, body: undefined });
    return this.respond(() => this.handleResources(url, headers));
  }

  private respond(handler: () => HttpResult): Promise<HttpResult> {
    const failure = this.failures.shift();
    if (failure === undefined) return Promise.resolve(handler());
    if (failure === 'network_error') return Promise.reject(new Error('fake network failure'));
    return Promise.resolve(this.failureResult(failure));
  }

  private failureResult(failure: Exclude<FakeFailure, 'network_error'>): HttpResult {
    switch (failure) {
      case 'invalid_grant':
        return json(403, {
          error: 'invalid_grant',
          error_description: 'Unknown or invalid refresh token.',
        });
      case 'rate_limited':
        return json(429, { message: 'slow down' }, { 'retry-after': String(this.retryAfter) });
      case 'server_error':
        return json(500, { message: 'boom' });
      case 'malformed':
        return json(200, { unexpected: true });
    }
  }

  private handleToken(url: string, body: unknown): HttpResult {
    if (url !== `${this.authBaseUrl}/oauth/token`) return json(404, {});
    const data = (body ?? {}) as Record<string, unknown>;
    if (data.grant_type === 'authorization_code') {
      if (typeof data.code !== 'string' || !this.codes.delete(data.code)) {
        return json(400, { error: 'invalid_grant' });
      }
    } else if (data.grant_type === 'refresh_token') {
      if (typeof data.refresh_token !== 'string' || data.refresh_token !== this.validRefreshToken) {
        return json(403, { error: 'invalid_grant' });
      }
    } else {
      return json(400, { error: 'unsupported_grant_type' });
    }
    const id = ++this.counter;
    this.validRefreshToken = `refresh-${id}`;
    this.accessTokens.add(`access-${id}`);
    return json(200, {
      access_token: `access-${id}`,
      refresh_token: this.validRefreshToken,
      expires_in: this.expiresIn,
      scope: this.scope,
      token_type: 'Bearer',
    });
  }

  private handleResources(url: string, headers: Record<string, string>): HttpResult {
    if (url !== `${this.apiBaseUrl}/oauth/token/accessible-resources`) return json(404, {});
    const token = (headers.Authorization ?? headers.authorization ?? '').replace(/^Bearer /, '');
    if (!this.accessTokens.has(token)) return json(401, { message: 'Unauthorized' });
    return json(200, this.resources);
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResult {
  return { status, headers, body };
}
