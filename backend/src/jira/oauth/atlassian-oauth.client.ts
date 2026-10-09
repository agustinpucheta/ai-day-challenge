import { z } from 'zod';
import {
  AtlassianInvalidGrantError,
  AtlassianProtocolError,
  AtlassianRateLimitedError,
  AtlassianUnavailableError,
  JiraOAuthNotConfiguredError,
} from './atlassian-errors';
import type { HttpPort, HttpResult } from './http-port';

export interface AtlassianOAuthSettings {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Space-separated scopes. */
  scopes: string;
  authBaseUrl: string;
  apiBaseUrl: string;
}

export interface AtlassianTokens {
  accessToken: string;
  /** Always the newest refresh token: the previous one is disabled by Atlassian. */
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}

export interface AccessibleResource {
  cloudId: string;
  name: string;
  url: string;
  scopes: string[];
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string().default(''),
});

const resourcesResponse = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    url: z.string(),
    scopes: z.array(z.string()).default([]),
  }),
);

/**
 * Atlassian OAuth 2.0 (3LO) client. Stateless, no retries, no logging: callers decide what to
 * do with each typed error. `settings` is null when OAuth is not configured.
 */
export class AtlassianOAuthClient {
  constructor(
    private readonly settings: AtlassianOAuthSettings | null,
    private readonly http: HttpPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  buildAuthorizeUrl(state: string): string {
    const settings = this.requireSettings();
    const url = new URL('/authorize', settings.authBaseUrl);
    url.search = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: settings.clientId,
      scope: settings.scopes,
      redirect_uri: settings.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string): Promise<AtlassianTokens> {
    const settings = this.requireSettings();
    return await this.requestTokens(settings, {
      grant_type: 'authorization_code',
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      code,
      redirect_uri: settings.redirectUri,
    });
  }

  async refresh(refreshToken: string): Promise<AtlassianTokens> {
    const settings = this.requireSettings();
    return await this.requestTokens(settings, {
      grant_type: 'refresh_token',
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: refreshToken,
    });
  }

  async listAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
    const settings = this.requireSettings();
    const result = await this.call(() =>
      this.http.getJson(`${trimSlash(settings.apiBaseUrl)}/oauth/token/accessible-resources`, {
        Authorization: `Bearer ${accessToken}`,
      }),
    );
    const parsed = resourcesResponse.safeParse(this.successBody(result));
    if (!parsed.success) throw new AtlassianProtocolError();
    return parsed.data.map((item) => ({
      cloudId: item.id,
      name: item.name,
      url: item.url,
      scopes: item.scopes,
    }));
  }

  private async requestTokens(
    settings: AtlassianOAuthSettings,
    body: Record<string, string>,
  ): Promise<AtlassianTokens> {
    const result = await this.call(() =>
      this.http.postJson(`${trimSlash(settings.authBaseUrl)}/oauth/token`, body),
    );
    const parsed = tokenResponse.safeParse(this.successBody(result));
    if (!parsed.success) throw new AtlassianProtocolError();
    const data = parsed.data;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(this.now().getTime() + data.expires_in * 1000),
      scopes: data.scope.split(/\s+/).filter(Boolean),
    };
  }

  /** Transport failures (network, timeout) become `AtlassianUnavailableError`; the cause is dropped. */
  private async call(send: () => Promise<HttpResult>): Promise<HttpResult> {
    try {
      return await send();
    } catch {
      throw new AtlassianUnavailableError();
    }
  }

  /** Returns the body of a 2xx result or throws the typed error for the status. */
  private successBody(result: HttpResult): unknown {
    const { status } = result;
    if (status >= 200 && status < 300) return result.body;
    if (status === 429) throw new AtlassianRateLimitedError(parseRetryAfter(result.headers));
    if (status >= 500) throw new AtlassianUnavailableError();
    const error = (result.body as { error?: unknown } | undefined)?.error;
    if ((status === 400 || status === 403) && error === 'invalid_grant') {
      throw new AtlassianInvalidGrantError();
    }
    throw new AtlassianProtocolError(status);
  }

  private requireSettings(): AtlassianOAuthSettings {
    if (this.settings === null) throw new JiraOAuthNotConfiguredError();
    return this.settings;
  }
}

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

function parseRetryAfter(headers: Record<string, string>): number | undefined {
  const seconds = Number(headers['retry-after']);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
