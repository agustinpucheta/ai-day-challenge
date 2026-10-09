import type { components } from './schema';

export type ValidationDetail = components['schemas']['ValidationDetailDto'];
type BackendErrorCode = components['schemas']['ErrorResponseDto']['code'];

/** Error codes produced on the client side, never sent by the backend. */
export const ClientErrorCode = {
  /** The request never got an HTTP response (offline, DNS, proxy down, CORS). */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** The server answered with something that is not the normalized `{ code, message }` body. */
  UNEXPECTED_RESPONSE: 'UNEXPECTED_RESPONSE',
} as const;

export type ApiErrorCode =
  BackendErrorCode | (typeof ClientErrorCode)[keyof typeof ClientErrorCode];

/** Typed error for every failed API call. `status` is 0 when there was no HTTP response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode | (string & {}),
    message: string,
    public readonly details?: ValidationDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

/** Message safe to show to the user for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}
