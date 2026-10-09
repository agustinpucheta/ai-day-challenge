import { isApiError } from '@/api/errors';
import { es } from '@/i18n/es';

export interface FailureCopy {
  title: string;
  text: string;
  /** Whether trying again can change the outcome. */
  retry: boolean;
}

/** Human copy for a normalized error code (from a failed call or from a per-item error). */
export function describeFailure(code: string, retryAfterSeconds?: number): FailureCopy {
  const f = es.failure;
  switch (code) {
    case 'ISSUE_NOT_FOUND_OR_INACCESSIBLE':
      return { ...f.issueNotFound, retry: false };
    case 'JIRA_NOT_CONNECTED':
      return { ...f.notConfigured, retry: true };
    case 'JIRA_REAUTH_REQUIRED':
      return { ...f.reauth, retry: true };
    case 'JIRA_FORBIDDEN':
      return { ...f.forbidden, retry: true };
    case 'JIRA_RATE_LIMITED':
      return {
        title: f.rateLimitedTitle,
        text:
          retryAfterSeconds === undefined
            ? f.rateLimitedNoWait
            : f.rateLimitedIn(retryAfterSeconds),
        retry: true,
      };
    case 'JIRA_UNAVAILABLE':
      return { ...f.unavailable, retry: true };
    case 'NETWORK_ERROR':
      return { ...f.network, retry: true };
    case 'TRACKING_LIMIT_REACHED':
      return { ...f.trackingLimit, retry: false };
    default:
      return { ...f.generic, retry: true };
  }
}

/** One-line message for the outcome of a track/untrack action. */
export function actionErrorMessage(error: unknown): string {
  if (!isApiError(error)) return es.common.unexpected;
  const copy = describeFailure(error.code, error.retryAfterSeconds);
  return `${copy.title}. ${copy.text}`;
}
