import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UsersService } from '../users/users.service';
import { AuthenticatedRequest, toAuthenticatedUser } from './auth.types';
import { IS_PUBLIC_KEY } from './decorators';

/**
 * Global guard: every route requires a valid server-side session unless marked @Public().
 * The user id comes only from the session; disabled or deleted users are rejected.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.session?.userId;
    if (!userId) {
      throw new AppException(401, ErrorCode.UNAUTHENTICATED, 'Authentication required');
    }
    const user = await this.users.findActiveById(userId);
    if (!user) {
      throw new AppException(401, ErrorCode.UNAUTHENTICATED, 'Authentication required');
    }
    req.authUser = toAuthenticatedUser(user);
    return true;
  }
}
