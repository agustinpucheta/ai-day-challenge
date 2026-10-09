import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';
import { isRequestOriginAllowed } from './origin-check';

export function createOriginCheckMiddleware(allowedOrigins: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const allowed = isRequestOriginAllowed(
      { method: req.method, origin: req.headers.origin, referer: req.headers.referer },
      allowedOrigins,
    );
    if (allowed) {
      next();
      return;
    }
    res.status(403).json({
      code: ErrorCode.FORBIDDEN_ORIGIN,
      message: 'Request origin is not allowed',
    });
  };
}
