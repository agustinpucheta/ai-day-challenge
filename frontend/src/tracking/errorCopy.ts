import { isApiError } from '@/api/errors';

export interface FailureCopy {
  title: string;
  text: string;
  /** Whether trying again can change the outcome. */
  retry: boolean;
}

/** Human copy for a normalized error code (from a failed call or from a per-item error). */
export function describeFailure(code: string, retryAfterSeconds?: number): FailureCopy {
  switch (code) {
    case 'ISSUE_NOT_FOUND_OR_INACCESSIBLE':
      return {
        title: 'Issue not found or no access',
        text: "It doesn't exist, or the configured Jira account cannot see it.",
        retry: false,
      };
    case 'JIRA_NOT_CONNECTED':
      return {
        title: 'Jira is not configured',
        text: 'Set JIRA_URL, JIRA_USERNAME and JIRA_API_TOKEN in the backend environment, then restart the backend.',
        retry: true,
      };
    case 'JIRA_REAUTH_REQUIRED':
      return {
        title: 'Jira rejected the API token',
        text: 'Create a new token at id.atlassian.com → Security → API tokens, update JIRA_API_TOKEN and restart the backend.',
        retry: true,
      };
    case 'JIRA_FORBIDDEN':
      return {
        title: 'Jira denied access',
        text: 'The configured account is not allowed to read this data. Check its permissions in Jira.',
        retry: true,
      };
    case 'JIRA_RATE_LIMITED':
      return {
        title: 'Jira is rate limiting requests',
        text:
          retryAfterSeconds === undefined
            ? 'Too many requests were sent to Jira. Try again in a moment.'
            : `Too many requests were sent to Jira. Retry in ${retryAfterSeconds} seconds.`,
        retry: true,
      };
    case 'JIRA_UNAVAILABLE':
      return {
        title: 'Jira is unavailable',
        text: 'Jira did not answer correctly. This is usually temporary.',
        retry: true,
      };
    case 'NETWORK_ERROR':
      return {
        title: 'Cannot reach the server',
        text: 'Check your connection and that the backend is running.',
        retry: true,
      };
    case 'TRACKING_LIMIT_REACHED':
      return {
        title: 'Tracking limit reached',
        text: 'You can track up to 50 issues. Stop tracking one to add another.',
        retry: false,
      };
    default:
      return {
        title: 'Something went wrong',
        text: 'This could not be completed. Please try again.',
        retry: true,
      };
  }
}

/** One-line message for the outcome of a track/untrack action. */
export function actionErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  const copy = describeFailure(error.code, error.retryAfterSeconds);
  return `${copy.title}. ${copy.text}`;
}
