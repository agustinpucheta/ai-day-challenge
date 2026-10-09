import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

const DESCRIPTIONS: Record<number, string> = {
  400: 'VALIDATION_ERROR: invalid or non-whitelisted input',
  401: 'UNAUTHENTICATED (no valid session) or INVALID_CREDENTIALS (login)',
  403: 'FORBIDDEN_ORIGIN (CSRF origin check) or REGISTRATION_DISABLED',
  409: 'EMAIL_ALREADY_REGISTERED',
  429: 'RATE_LIMITED',
  503: 'DATABASE_UNAVAILABLE',
};

/** Documents the normalized `{ code, message }` error body for the given statuses. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({ status, description: DESCRIPTIONS[status], type: ErrorResponseDto }),
    ),
  );
}
