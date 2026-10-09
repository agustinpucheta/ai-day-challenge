import { HttpException } from '@nestjs/common';
import type { ErrorBody, ErrorCode, ValidationDetail } from './error-codes';

/** HttpException whose response body is already the normalized `{ code, message }` shape. */
export class AppException extends HttpException {
  constructor(status: number, code: ErrorCode, message: string, details?: ValidationDetail[]) {
    const body: ErrorBody = details ? { code, message, details } : { code, message };
    super(body, status);
  }
}
