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
