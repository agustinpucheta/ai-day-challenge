import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'VALIDATION_ERROR: invalid or non-whitelisted input',
  401: 'UNAUTHENTICATED (no valid session) or INVALID_CREDENTIALS (login)',
  403: 'FORBIDDEN_ORIGIN (CSRF origin check) or REGISTRATION_DISABLED',
  409: 'EMAIL_ALREADY_REGISTERED or JIRA_NOT_CONNECTED (Jira credentials not configured)',
  424: 'JIRA_REAUTH_REQUIRED (Jira rejected the API token) or JIRA_FORBIDDEN (account lacks permission)',
  429: 'RATE_LIMITED (local throttle) or JIRA_RATE_LIMITED (Jira; see Retry-After)',
  503: 'DATABASE_UNAVAILABLE or JIRA_UNAVAILABLE',
};

/** Documents the normalized `{ code, message }` error body for the given statuses. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, description: DESCRIPTIONS[status], type: ErrorResponseDto }),
    ),
  );
}
