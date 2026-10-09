import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global SessionGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The user resolved from the server-side session. Never taken from client input. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.authUser) {
      throw new AppException(401, ErrorCode.UNAUTHENTICATED, 'Authentication required');
    }
    return req.authUser;
  },
);
