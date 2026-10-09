/**
 * Typed Atlassian OAuth failures. Messages are fixed strings: they never carry tokens,
 * the client secret, authorization codes or remote response bodies.
 */
export class JiraOAuthNotConfiguredError extends Error {
  constructor() {
    super('Atlassian OAuth is not configured');
    this.name = 'JiraOAuthNotConfiguredError';
  }
}

/** The refresh token or authorization code is invalid, expired or revoked. */
export class AtlassianInvalidGrantError extends Error {
  constructor() {
    super('Atlassian rejected the grant (invalid_grant)');
    this.name = 'AtlassianInvalidGrantError';
  }
}

export class AtlassianRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super('Atlassian rate limit reached');
    this.name = 'AtlassianRateLimitedError';
  }
}

/** 5xx, network failure or timeout. Safe to retry later. */
export class AtlassianUnavailableError extends Error {
  constructor() {
    super('Atlassian is unavailable');
    this.name = 'AtlassianUnavailableError';
  }
}

/** The response did not match the documented contract. Only the HTTP status is kept. */
export class AtlassianProtocolError extends Error {
  constructor(readonly status?: number) {
    super(
      status === undefined
        ? 'Unexpected response shape from Atlassian'
        : `Unexpected response from Atlassian (HTTP ${status})`,
    );
    this.name = 'AtlassianProtocolError';
  }
}
