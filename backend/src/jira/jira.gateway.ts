import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from './credentials/jira-credential-provider';
import {
  JiraForbiddenError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';
import { HTTP_PORT, type HttpPort, type HttpResult } from './oauth/http-port';

export interface JiraConnectionInfo {
  siteUrl: string;
  displayName: string;
}

const myselfResponse = z.object({ displayName: z.string().min(1) });

/**
 * Minimal Jira access. Every call resolves credentials through the provider, goes through the
 * `HttpPort` (10 s timeout, no retries, no redirects) and surfaces only typed errors with fixed
 * messages: never the token, the email, the Authorization header or remote bodies.
 */
@Injectable()
export class JiraGateway {
  constructor(
    @Inject(JIRA_CREDENTIAL_PROVIDER) private readonly credentials: JiraCredentialProvider,
    @Inject(HTTP_PORT) private readonly http: HttpPort,
  ) {}

  /** `GET /rest/api/3/myself` (read-only). Returns only the site URL and display name. */
  async verifyConnection(userId: string): Promise<JiraConnectionInfo> {
    const auth = await this.credentials.resolve(userId);
    let result: HttpResult;
    try {
      result = await this.http.getJson(`${auth.baseUrl}/rest/api/3/myself`, auth.headers());
    } catch {
      // Network failure or timeout. The cause is dropped on purpose.
      throw new JiraUnavailableError();
    }
    const body = successBody(result);
    const parsed = myselfResponse.safeParse(body);
    if (!parsed.success) throw new JiraProtocolError();
    return { siteUrl: auth.siteUrl, displayName: parsed.data.displayName };
  }
}

/** Returns the body of a 2xx result or throws the typed error for the status. */
function successBody(result: HttpResult): unknown {
  const { status } = result;
  if (status >= 200 && status < 300) return result.body;
  if (status === 401) throw new JiraUnauthorizedError();
  if (status === 403) throw new JiraForbiddenError();
  if (status === 429) throw new JiraRateLimitedError(parseRetryAfter(result.headers));
  if (status >= 500) throw new JiraUnavailableError();
  throw new JiraProtocolError(status);
}

function parseRetryAfter(headers: Record<string, string>): number | undefined {
  const seconds = Number(headers['retry-after']);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
