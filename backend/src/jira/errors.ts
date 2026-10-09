/**
 * Typed Jira access failures. Messages are fixed strings: they never carry the API token,
 * the account email, the Authorization header or remote response bodies.
 */
export class JiraNotConfiguredError extends Error {
  constructor() {
    super('Jira credentials are not configured');
    this.name = 'JiraNotConfiguredError';
  }
}

/** Jira answered 401: the token is invalid, expired or revoked. */
export class JiraUnauthorizedError extends Error {
  constructor() {
    super('Jira rejected the credentials');
    this.name = 'JiraUnauthorizedError';
  }
}

/** Jira answered 403: the account lacks permission. */
export class JiraForbiddenError extends Error {
  constructor() {
    super('Jira denied access for this account');
    this.name = 'JiraForbiddenError';
  }
}

export class JiraRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super('Jira rate limit reached');
    this.name = 'JiraRateLimitedError';
  }
}

/** 5xx, network failure or timeout. Safe to retry later. */
export class JiraUnavailableError extends Error {
  constructor() {
    super('Jira is unavailable');
    this.name = 'JiraUnavailableError';
  }
}

/** The response did not match the documented contract. Only the HTTP status is kept. */
export class JiraProtocolError extends Error {
  constructor(readonly status?: number) {
    super(
      status === undefined
        ? 'Unexpected response shape from Jira'
        : `Unexpected response from Jira (HTTP ${status})`,
    );
    this.name = 'JiraProtocolError';
  }
}

/** Jira answered 400 (for example an invalid JQL). Jira's message is dropped on purpose. */
export class JiraBadRequestError extends Error {
  constructor() {
    super('Jira rejected the request');
    this.name = 'JiraBadRequestError';
  }
}

/** The caller-supplied search input or paging parameters are invalid (no request was made). */
export class JiraInvalidQueryError extends Error {
  constructor() {
    super('Invalid search input');
    this.name = 'JiraInvalidQueryError';
  }
}

/**
 * The issue does not exist or is not visible. Jira answers 404 for both and 403 for restricted
 * issues; callers must not be able to tell them apart (privacy), so the gateway reports all of
 * them as this error. The real status is kept in a non-enumerable field for internal debugging
 * only: it is absent from `JSON.stringify` and must never be sent to clients.
 */
export class JiraIssueNotFoundError extends Error {
  declare readonly upstreamStatus: number | undefined;

  constructor(upstreamStatus?: number) {
    super('Issue not found');
    this.name = 'JiraIssueNotFoundError';
    Object.defineProperty(this, 'upstreamStatus', { value: upstreamStatus, enumerable: false });
  }
}
