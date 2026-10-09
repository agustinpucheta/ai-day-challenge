import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser, toAuthenticatedUser } from './auth.types';
import { normalizeEmail } from './email';
import { PasswordHasher } from './password-hasher';
import { PASSWORD_MIN_LENGTH, isPasswordAcceptable } from './password-policy';

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

function invalidCredentials(): AppException {
  // Same status and body for unknown email, wrong password and disabled account.
  return new AppException(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<AuthenticatedUser> {
    if (!isPasswordAcceptable(input.password)) {
      throw new AppException(400, ErrorCode.VALIDATION_ERROR, 'Password does not meet the policy', [
        {
          field: 'password',
          constraints: [`password must be at least ${PASSWORD_MIN_LENGTH} characters`],
        },
      ]);
    }
    const passwordHash = await this.hasher.hash(input.password);
    try {
      const user = await this.users.create({
        emailNormalized: normalizeEmail(input.email),
        displayName: input.displayName?.trim() || null,
        passwordHash,
      });
      await this.audit.record({ type: 'auth.register', success: true, userId: user.id });
      return toAuthenticatedUser(user);
    } catch (error) {
      const errorCode =
        error instanceof AppException
          ? ErrorCode.EMAIL_ALREADY_REGISTERED
          : ErrorCode.INTERNAL_ERROR;
      await this.audit.record({ type: 'auth.register', success: false, errorCode });
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.users.findByEmail(normalizeEmail(email));
    if (!user?.passwordHash) {
      await this.hasher.verifyDummy(password);
      await this.audit.record({
        type: 'auth.login',
        success: false,
        errorCode: ErrorCode.INVALID_CREDENTIALS,
        metadata: { reason: 'unknown_account' },
      });
      throw invalidCredentials();
    }
    const passwordMatches = await this.hasher.verify(user.passwordHash, password);
    if (!passwordMatches || user.disabledAt) {
      await this.audit.record({
        type: 'auth.login',
        success: false,
        userId: user.id,
        errorCode: ErrorCode.INVALID_CREDENTIALS,
        metadata: { reason: user.disabledAt ? 'disabled_account' : 'wrong_password' },
      });
      throw invalidCredentials();
    }
    await this.audit.record({ type: 'auth.login', success: true, userId: user.id });
    return toAuthenticatedUser(user);
  }

  async recordLogout(userId: string): Promise<void> {
    await this.audit.record({ type: 'auth.logout', success: true, userId });
  }
}
