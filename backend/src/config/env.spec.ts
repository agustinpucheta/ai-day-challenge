import { apiOrigin, isSwaggerEnabled, validateEnv } from './env';

const VALID = {
  NODE_ENV: 'development',
  API_PORT: '3000',
  WEB_ORIGIN: 'http://localhost:5173/',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('parses and normalizes a valid environment', () => {
    const env = validateEnv(VALID);
    expect(env.API_PORT).toBe(3000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173');
    expect(env.LOCAL_REGISTRATION_ENABLED).toBe(false);
    expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(5);
  });

  it('fails fast naming the variable but never echoing secret values', () => {
    const secret = 'too-short-secret';
    let message = '';
    try {
      validateEnv({ ...VALID, SESSION_SECRET: secret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SESSION_SECRET');
    expect(message).not.toContain(secret);
  });

  it('enables Swagger by default outside production and honors SWAGGER_ENABLED', () => {
    expect(isSwaggerEnabled(validateEnv(VALID))).toBe(true);
    expect(isSwaggerEnabled(validateEnv({ ...VALID, NODE_ENV: 'production' }))).toBe(false);
    expect(
      isSwaggerEnabled(validateEnv({ ...VALID, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })),
    ).toBe(true);
    expect(isSwaggerEnabled(validateEnv({ ...VALID, SWAGGER_ENABLED: 'false' }))).toBe(false);
  });

  it('derives the API origin from API_PORT unless API_ORIGIN is set', () => {
    expect(apiOrigin(validateEnv(VALID))).toBe('http://localhost:3000');
    expect(apiOrigin(validateEnv({ ...VALID, API_ORIGIN: 'https://api.example.com/x' }))).toBe(
      'https://api.example.com',
    );
  });

  it('rejects a missing database URL', () => {
    const withoutUrl: Record<string, unknown> = { ...VALID };
    delete withoutUrl.DATABASE_URL;
    expect(() => validateEnv(withoutUrl)).toThrow(/DATABASE_URL/);
  });
});
