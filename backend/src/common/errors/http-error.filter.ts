import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from './app-exception';
import { ErrorBody, ErrorCode } from './error-codes';

const BAD_REQUEST: ErrorBody = { code: ErrorCode.VALIDATION_ERROR, message: 'Invalid request' };
const INTERNAL: ErrorBody = { code: ErrorCode.INTERNAL_ERROR, message: 'Unexpected error' };

const DEFAULTS: Record<number, ErrorBody> = {
  400: BAD_REQUEST,
  401: { code: ErrorCode.UNAUTHENTICATED, message: 'Authentication required' },
  403: { code: ErrorCode.FORBIDDEN, message: 'Forbidden' },
  404: { code: ErrorCode.NOT_FOUND, message: 'Resource not found' },
  429: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests, try again later' },
};

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.code === 'string' && typeof record.message === 'string';
}

/** Status carried by non-Nest errors such as body-parser failures (e.g. malformed JSON). */
function clientErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return status;
    }
  }
  return null;
}

function defaultBody(status: number): ErrorBody {
  return DEFAULTS[status] ?? (status >= 500 ? INTERNAL : BAD_REQUEST);
}

/**
 * Converts every error into `{ code, message }`. Never echoes request data, stack
 * traces or upstream messages to the client.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    if (status >= 500) {
      const name = exception instanceof Error ? exception.name : 'UnknownError';
      this.logger.error(
        `Unhandled ${name}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    if (exception instanceof AppException && exception.retryAfterSeconds !== undefined) {
      res.setHeader('Retry-After', String(Math.ceil(exception.retryAfterSeconds)));
    }
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (isErrorBody(response)) {
        const body: ErrorBody = { code: response.code, message: response.message };
        if (response.details) {
          body.details = response.details;
        }
        return { status, body };
      }
      return { status, body: defaultBody(status) };
    }
    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== null) {
      return { status: clientStatus, body: defaultBody(clientStatus) };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: INTERNAL };
  }
}
