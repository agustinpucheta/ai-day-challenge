import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  JiraBadRequestError,
  JiraForbiddenError,
  JiraInvalidQueryError,
  JiraIssueNotFoundError,
  JiraNotConfiguredError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';

/**
 * Maps typed Jira failures to the normalized HTTP errors. Jira-side failures never use HTTP
 * 401/403 (those mean "app session" / "forbidden origin" to the frontend): upstream credential
 * problems are 424 with a Jira code. Unknown errors are returned untouched.
 */
export function toAppException(error: unknown): unknown {
  if (error instanceof JiraNotConfiguredError) {
    return new AppException(
      409,
      ErrorCode.JIRA_NOT_CONNECTED,
      'Jira credentials are not configured',
    );
  }
  if (error instanceof JiraUnauthorizedError) {
    return new AppException(
      424,
      ErrorCode.JIRA_REAUTH_REQUIRED,
      'Jira rejected the API token. Create a new token and replace JIRA_API_TOKEN',
    );
  }
  if (error instanceof JiraForbiddenError) {
    return new AppException(424, ErrorCode.JIRA_FORBIDDEN, 'The Jira account lacks permission');
  }
  if (error instanceof JiraIssueNotFoundError) {
    // Missing and inaccessible issues share one fixed response (no existence probing).
    return new AppException(
      404,
      ErrorCode.ISSUE_NOT_FOUND_OR_INACCESSIBLE,
      'The issue does not exist or is not accessible',
    );
  }
  if (error instanceof JiraInvalidQueryError) {
    return new AppException(400, ErrorCode.VALIDATION_ERROR, 'Request validation failed');
  }
  if (error instanceof JiraRateLimitedError) {
    return new AppException(
      429,
      ErrorCode.JIRA_RATE_LIMITED,
      'Jira rate limit reached, try again later',
      undefined,
      error.retryAfterSeconds,
    );
  }
  if (
    error instanceof JiraUnavailableError ||
    error instanceof JiraProtocolError ||
    error instanceof JiraBadRequestError
  ) {
    return new AppException(
      503,
      ErrorCode.JIRA_UNAVAILABLE,
      'Jira is unavailable, try again later',
    );
  }
  return error;
}
