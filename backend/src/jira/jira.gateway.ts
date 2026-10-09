import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from './credentials/jira-credential-provider';
import {
  JiraBadRequestError,
  JiraForbiddenError,
  JiraInvalidQueryError,
  JiraIssueNotFoundError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';
import { ISSUE_KEY_PATTERN, buildSearchJql } from './jira-jql';
import { JIRA_CONFIG, JIRA_ISSUE_FIELDS } from './jira.config';
import type { JiraIssuePage, JiraIssueResult } from './model/jira-issue';
import { mapJiraIssue } from './model/jira-issue.mapper';
import { HTTP_PORT, type HttpPort, type HttpResult } from './oauth/http-port';

export interface JiraConnectionInfo {
  siteUrl: string;
  displayName: string;
}

const myselfResponse = z.object({ displayName: z.string().min(1) });

const searchResponse = z.object({
  issues: z.array(z.unknown()),
  nextPageToken: z.string().nullish(),
  isLast: z.boolean().optional(),
});

const MAX_PAGE_TOKEN_LENGTH = 4096;

export interface SearchIssuesInput {
  query: string;
  pageToken?: string;
  pageSize?: number;
  issueTypeIds?: readonly string[];
}

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
    const body = successBody(result, 'general');
    const parsed = myselfResponse.safeParse(body);
    if (!parsed.success) throw new JiraProtocolError();
    return { siteUrl: auth.siteUrl, displayName: parsed.data.displayName };
  }

  /**
   * Enhanced JQL search (`POST /rest/api/3/search/jql`, token pagination, no `total`). An empty
   * page is returned only for an HTTP 200; every failure throws.
   */
  async searchIssues(userId: string, input: SearchIssuesInput): Promise<JiraIssuePage> {
    const pageSize = input.pageSize ?? JIRA_CONFIG.search.defaultPageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > JIRA_CONFIG.search.maxPageSize) {
      throw new JiraInvalidQueryError();
    }
    const { pageToken } = input;
    if (pageToken !== undefined && (pageToken === '' || pageToken.length > MAX_PAGE_TOKEN_LENGTH)) {
      throw new JiraInvalidQueryError();
    }
    const jql = buildSearchJql(input.query, { issueTypeIds: input.issueTypeIds });
    const auth = await this.credentials.resolve(userId);
    const body = {
      jql,
      fields: JIRA_ISSUE_FIELDS,
      maxResults: pageSize,
      ...(pageToken !== undefined && { nextPageToken: pageToken }),
    };
    const result = await this.send(() =>
      this.http.postJson(`${auth.baseUrl}/rest/api/3/search/jql`, body, auth.headers()),
    );
    const parsed = searchResponse.safeParse(successBody(result, 'general'));
    if (!parsed.success) throw new JiraProtocolError();
    const { issues, isLast, nextPageToken } = parsed.data;
    const next = isLast === true || !nextPageToken ? null : nextPageToken;
    // Not the last page but no continuation token: refusing beats silently truncating.
    if (isLast === false && next === null) throw new JiraProtocolError();
    return {
      issues: issues.map((issue) => mapJiraIssue(issue, auth.siteUrl)),
      nextPageToken: next,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * `GET /rest/api/3/issue/{key}`. A missing issue and an issue the account cannot see (404 or
   * 403) are both reported as `JiraIssueNotFoundError` so callers cannot probe for existence.
   */
  async getIssue(userId: string, issueKey: string): Promise<JiraIssueResult> {
    if (!ISSUE_KEY_PATTERN.test(issueKey)) throw new JiraInvalidQueryError();
    const auth = await this.credentials.resolve(userId);
    const fields = encodeURIComponent(JIRA_ISSUE_FIELDS.join(','));
    const url = `${auth.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey.toUpperCase())}?fields=${fields}`;
    const result = await this.send(() => this.http.getJson(url, auth.headers()));
    const issue = mapJiraIssue(successBody(result, 'issue'), auth.siteUrl);
    return { issue, fetchedAt: new Date().toISOString() };
  }

  /** Network failure or timeout. The cause is dropped on purpose. */
  private async send(call: () => Promise<HttpResult>): Promise<HttpResult> {
    try {
      return await call();
    } catch {
      throw new JiraUnavailableError();
    }
  }
}

/** Returns the body of a 2xx result or throws the typed error for the status. */
function successBody(result: HttpResult, scope: 'general' | 'issue'): unknown {
  const { status } = result;
  if (status >= 200 && status < 300) return result.body;
  if (status === 400) throw new JiraBadRequestError();
  if (status === 401) throw new JiraUnauthorizedError();
  if (scope === 'issue' && (status === 403 || status === 404)) {
    throw new JiraIssueNotFoundError(status);
  }
  if (status === 403) throw new JiraForbiddenError();
  if (status === 429) throw new JiraRateLimitedError(parseRetryAfter(result.headers));
  if (status >= 500) throw new JiraUnavailableError();
  throw new JiraProtocolError(status);
}

function parseRetryAfter(headers: Record<string, string>): number | undefined {
  const seconds = Number(headers['retry-after']);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}
