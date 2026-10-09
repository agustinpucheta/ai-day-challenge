import { HttpException } from '@nestjs/common';
import type { ErrorBody, ErrorCode, ValidationDetail } from './error-codes';

/** HttpException whose response body is already the normalized `{ code, message }` shape. */
export class AppException extends HttpException {
  /** Sent as the `Retry-After` header by the error filter; never part of the body. */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: ValidationDetail[],
    retryAfterSeconds?: number,
  ) {
    const body: ErrorBody = details ? { code, message, details } : { code, message };
    super(body, status);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
