import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { AuditService } from '../audit/audit.service';
import type { UserRecord, UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { PasswordHasher } from './password-hasher';

const CORRECT_PASSWORD = 'correct horse battery staple';

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    emailNormalized: 'ana@example.com',
    displayName: 'Ana',
    passwordHash: 'stored-hash',
    disabledAt: null,
    ...overrides,
  };
}

function setup(user: UserRecord | null) {
  const users = {
    findByEmail: jest.fn().mockResolvedValue(user),
    create: jest.fn(),
  };
  const hasher = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn((_hash: string, password: string) =>
      Promise.resolve(password === CORRECT_PASSWORD),
    ),
    verifyDummy: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    users as unknown as UsersService,
    hasher as unknown as PasswordHasher,
    audit as unknown as AuditService,
  );
  return { service, users, hasher, audit };
}

async function captureFailure(
  promise: Promise<unknown>,
): Promise<{ status: number; body: unknown }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
  throw new Error('Expected login to fail');
}

describe('AuthService.login', () => {
  it('returns the user for valid credentials, matching the email case-insensitively', async () => {
    const { service, users } = setup(makeUser());
    const result = await service.login(' ANA@example.com ', CORRECT_PASSWORD);
    expect(users.findByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(result).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'ana@example.com',
      displayName: 'Ana',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('yields an identical failure for unknown email, wrong password and disabled user', async () => {
    const unknown = setup(null);
    const wrong = setup(makeUser());
    const disabled = setup(makeUser({ disabledAt: new Date() }));

    const a = await captureFailure(
      unknown.service.login('nobody@example.com', 'whatever-password'),
    );
    const b = await captureFailure(wrong.service.login('ana@example.com', 'wrong-password-123'));
    const c = await captureFailure(disabled.service.login('ana@example.com', CORRECT_PASSWORD));

    expect(a).toEqual({
      status: 401,
      body: { code: ErrorCode.INVALID_CREDENTIALS, message: 'Invalid email or password' },
    });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('runs a dummy hash verification for unknown users to equalize timing', async () => {
    const { service, hasher } = setup(null);
    await captureFailure(service.login('nobody@example.com', 'whatever-password'));
    expect(hasher.verifyDummy).toHaveBeenCalledTimes(1);
    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it('audits failures without the password or email', async () => {
    const { service, audit } = setup(makeUser());
    await captureFailure(service.login('ana@example.com', 'wrong-password-123'));
    const serialized = JSON.stringify(audit.record.mock.calls);
    expect(serialized).not.toContain('wrong-password-123');
    expect(serialized).not.toContain('ana@example.com');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth.login', success: false }),
    );
  });
});

describe('AuthService.register', () => {
  it('normalizes the email and stores only the hash', async () => {
    const { service, users, hasher } = setup(null);
    users.create.mockResolvedValue(makeUser({ passwordHash: 'new-hash' }));
    const result = await service.register({
      email: '  Ana@Example.com ',
      password: CORRECT_PASSWORD,
      displayName: 'Ana',
    });
    expect(hasher.hash).toHaveBeenCalledWith(CORRECT_PASSWORD);
    expect(users.create).toHaveBeenCalledWith({
      emailNormalized: 'ana@example.com',
      displayName: 'Ana',
      passwordHash: 'new-hash',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects a password that violates the policy before hashing', async () => {
    const { service, hasher } = setup(null);
    const failure = await captureFailure(
      service.register({ email: 'ana@example.com', password: 'short' }),
    );
    expect(failure.status).toBe(400);
    expect(hasher.hash).not.toHaveBeenCalled();
  });
});
