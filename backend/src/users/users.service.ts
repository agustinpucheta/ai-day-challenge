import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';

/** Internal user projection. `passwordHash` must never leave the auth layer. */
export interface UserRecord {
  id: string;
  emailNormalized: string;
  displayName: string | null;
  passwordHash: string | null;
  disabledAt: Date | null;
}

export interface CreateUserInput {
  emailNormalized: string;
  displayName: string | null;
  passwordHash: string;
}

const USER_SELECT = {
  id: true,
  emailNormalized: true,
  displayName: true,
  passwordHash: true,
  disabledAt: true,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(emailNormalized: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { emailNormalized }, select: USER_SELECT });
  }

  findActiveById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({ where: { id, disabledAt: null }, select: USER_SELECT });
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({ data: input, select: USER_SELECT });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(
          409,
          ErrorCode.EMAIL_ALREADY_REGISTERED,
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }
}
