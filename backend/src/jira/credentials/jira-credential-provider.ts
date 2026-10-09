/**
 * What the gateway needs to call Jira for one request. The secret and the Authorization
 * value stay private to the provider: callers can only ask for the finished headers.
 */
export interface JiraRequestAuth {
  /** Base for REST calls, without trailing slash (`<baseUrl>/rest/api/3/...`). */
  readonly baseUrl: string;
  /** Human-facing Jira site origin. */
  readonly siteUrl: string;
  /** Headers to send with the request, built on demand. */
  headers(): Record<string, string>;
}

export interface JiraCredentialProvider {
  /**
   * Resolves the credentials to use for an authenticated local user.
   * Throws `JiraNotConfiguredError` when no credentials are available.
   */
  resolve(userId: string): Promise<JiraRequestAuth>;
}

export const JIRA_CREDENTIAL_PROVIDER = Symbol('JIRA_CREDENTIAL_PROVIDER');
