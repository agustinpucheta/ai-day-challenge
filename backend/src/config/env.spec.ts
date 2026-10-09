import { apiOrigin, isSwaggerEnabled, tokenKeyringFromEnv, validateEnv } from './env';

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

  describe('Jira OAuth and token encryption', () => {
    const KEY = Buffer.alloc(32, 7).toString('base64');
    const OAUTH = {
      ATLASSIAN_CLIENT_ID: 'client-id',
      ATLASSIAN_CLIENT_SECRET: 'client-secret-value',
      ATLASSIAN_REDIRECT_URI: 'http://localhost:3000/api/jira/callback',
    };

    function messageOf(raw: Record<string, unknown>): string {
      try {
        validateEnv(raw);
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    }

    it('boots without any Atlassian or encryption variable and applies defaults', () => {
      const env = validateEnv(VALID);
      expect(env.jiraOAuthConfigured).toBe(false);
      expect(env.TOKEN_ENCRYPTION_KEY).toBeUndefined();
      expect(env.TOKEN_ENCRYPTION_KEY_VERSION).toBe(1);
      expect(env.ATLASSIAN_SCOPES).toBe('read:jira-work write:jira-work offline_access');
      expect(env.ATLASSIAN_AUTH_BASE_URL).toBe('https://auth.atlassian.com');
      expect(env.ATLASSIAN_API_BASE_URL).toBe('https://api.atlassian.com');
    });

    it('accepts an optional preferred site URL with no default and rejects a malformed one', () => {
      expect(validateEnv(VALID).ATLASSIAN_PREFERRED_SITE_URL).toBeUndefined();
      const empty = validateEnv({ ...VALID, ATLASSIAN_PREFERRED_SITE_URL: '' });
      expect(empty.ATLASSIAN_PREFERRED_SITE_URL).toBeUndefined();
      const set = validateEnv({
        ...VALID,
        ATLASSIAN_PREFERRED_SITE_URL: 'https://acme.atlassian.net',
      });
      expect(set.ATLASSIAN_PREFERRED_SITE_URL).toBe('https://acme.atlassian.net');
      expect(messageOf({ ...VALID, ATLASSIAN_PREFERRED_SITE_URL: 'not a url' })).toContain(
        'ATLASSIAN_PREFERRED_SITE_URL',
      );
    });

    it('treats empty strings as unset', () => {
      const env = validateEnv({
        ...VALID,
        ATLASSIAN_CLIENT_ID: '',
        ATLASSIAN_CLIENT_SECRET: '',
        ATLASSIAN_REDIRECT_URI: '',
        ATLASSIAN_SCOPES: '',
        TOKEN_ENCRYPTION_KEY: '',
        TOKEN_ENCRYPTION_KEY_VERSION: '',
      });
      expect(env.jiraOAuthConfigured).toBe(false);
      expect(env.ATLASSIAN_SCOPES).toContain('offline_access');
      expect(env.TOKEN_ENCRYPTION_KEY_VERSION).toBe(1);
    });

    it('is configured only when client id, secret and redirect URI are all present', () => {
      const partial = { ...VALID, ATLASSIAN_CLIENT_ID: 'id' };
      expect(validateEnv(partial).jiraOAuthConfigured).toBe(false);
      const full = validateEnv({ ...VALID, ...OAUTH, TOKEN_ENCRYPTION_KEY: KEY });
      expect(full.jiraOAuthConfigured).toBe(true);
    });

    it('requires a valid encryption key when OAuth is configured, naming only the variable', () => {
      expect(messageOf({ ...VALID, ...OAUTH })).toContain('TOKEN_ENCRYPTION_KEY');
      const bad = 'not-a-32-byte-key';
      const message = messageOf({ ...VALID, ...OAUTH, TOKEN_ENCRYPTION_KEY: bad });
      expect(message).toContain('TOKEN_ENCRYPTION_KEY');
      for (const secret of [bad, OAUTH.ATLASSIAN_CLIENT_SECRET]) {
        expect(message).not.toContain(secret);
      }
    });

    it('rejects an invalid key even when OAuth is not configured', () => {
      expect(messageOf({ ...VALID, TOKEN_ENCRYPTION_KEY: 'c2hvcnQ=' })).toContain(
        'TOKEN_ENCRYPTION_KEY',
      );
    });

    it('validates the key version and previous keys', () => {
      const base = { ...VALID, TOKEN_ENCRYPTION_KEY: KEY };
      expect(messageOf({ ...base, TOKEN_ENCRYPTION_KEY_VERSION: '0' })).toContain(
        'TOKEN_ENCRYPTION_KEY_VERSION',
      );
      expect(messageOf({ ...base, TOKEN_ENCRYPTION_PREVIOUS_KEYS: '{bad json' })).toContain(
        'TOKEN_ENCRYPTION_PREVIOUS_KEYS',
      );
      expect(messageOf({ ...base, TOKEN_ENCRYPTION_PREVIOUS_KEYS: '{"1":"c2hvcnQ="}' })).toContain(
        'TOKEN_ENCRYPTION_PREVIOUS_KEYS',
      );
      const ok = validateEnv({
        ...base,
        TOKEN_ENCRYPTION_KEY_VERSION: '2',
        TOKEN_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ 1: KEY }),
      });
      expect(ok.TOKEN_ENCRYPTION_PREVIOUS_KEYS).toEqual({ '1': KEY });
    });

    it('builds a keyring from the validated variables', () => {
      expect(tokenKeyringFromEnv(validateEnv(VALID))).toBeNull();
      const keyring = tokenKeyringFromEnv(
        validateEnv({
          ...VALID,
          TOKEN_ENCRYPTION_KEY: KEY,
          TOKEN_ENCRYPTION_KEY_VERSION: '2',
          TOKEN_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ 1: KEY }),
        }),
      );
      expect(keyring?.currentVersion).toBe(2);
      expect(Object.keys(keyring?.keys ?? {})).toEqual(['1', '2']);
    });

    it('requires an http(s) redirect URI and https in production', () => {
      const base = { ...VALID, ...OAUTH, TOKEN_ENCRYPTION_KEY: KEY };
      expect(messageOf({ ...base, ATLASSIAN_REDIRECT_URI: 'ftp://host/cb' })).toContain(
        'ATLASSIAN_REDIRECT_URI',
      );
      expect(messageOf({ ...base, NODE_ENV: 'production' })).toContain('ATLASSIAN_REDIRECT_URI');
      expect(
        messageOf({
          ...base,
          NODE_ENV: 'production',
          ATLASSIAN_REDIRECT_URI: 'https://app.example.com/api/jira/callback',
        }),
      ).toBe('');
    });
  });

  describe('Jira API token (single-user mode)', () => {
    const TOKEN = 'ATATT-super-secret-token-value';
    const JIRA = {
      JIRA_URL: 'https://acme.atlassian.net',
      JIRA_USERNAME: 'owner@example.com',
      JIRA_API_TOKEN: TOKEN,
    };

    function messageOf(raw: Record<string, unknown>): string {
      try {
        validateEnv(raw);
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    }

    it('is unconfigured when no variable is set, and empty strings count as unset', () => {
      const env = validateEnv(VALID);
      expect(env.jiraApiTokenConfigured).toBe(false);
      expect(env.JIRA_API_TOKEN).toBeUndefined();
      const empty = validateEnv({ ...VALID, JIRA_URL: '', JIRA_USERNAME: '', JIRA_API_TOKEN: '' });
      expect(empty.jiraApiTokenConfigured).toBe(false);
    });

    it('is configured when all three variables are set', () => {
      const env = validateEnv({ ...VALID, ...JIRA });
      expect(env.jiraApiTokenConfigured).toBe(true);
      expect(env.JIRA_URL).toBe('https://acme.atlassian.net');
      expect(env.JIRA_USERNAME).toBe('owner@example.com');
      expect(env.JIRA_API_TOKEN?.reveal()).toBe(TOKEN);
    });

    it('fails on a partial configuration naming only the missing variables', () => {
      const message = messageOf({ ...VALID, JIRA_URL: JIRA.JIRA_URL, JIRA_API_TOKEN: TOKEN });
      expect(message).toContain('JIRA_USERNAME');
      expect(message).not.toContain('JIRA_URL');
      expect(message).not.toContain('JIRA_API_TOKEN');
      expect(message).not.toContain(TOKEN);
      expect(messageOf({ ...VALID, JIRA_API_TOKEN: TOKEN })).toMatch(/JIRA_URL.*JIRA_USERNAME/);
    });

    it('normalizes the URL to its origin', () => {
      const env = validateEnv({
        ...VALID,
        ...JIRA,
        JIRA_URL: 'https://acme.atlassian.net/jira/software/?x=1',
      });
      expect(env.JIRA_URL).toBe('https://acme.atlassian.net');
      expect(
        validateEnv({ ...VALID, ...JIRA, JIRA_URL: 'https://acme.atlassian.net/' }).JIRA_URL,
      ).toBe('https://acme.atlassian.net');
    });

    it('requires https except for localhost and 127.0.0.1', () => {
      expect(messageOf({ ...VALID, ...JIRA, JIRA_URL: 'http://acme.atlassian.net' })).toContain(
        'JIRA_URL',
      );
      expect(messageOf({ ...VALID, ...JIRA, JIRA_URL: 'ftp://acme.atlassian.net' })).toContain(
        'JIRA_URL',
      );
      expect(messageOf({ ...VALID, ...JIRA, JIRA_URL: 'not a url' })).toContain('JIRA_URL');
      expect(messageOf({ ...VALID, ...JIRA, JIRA_URL: 'http://localhost:4010' })).toBe('');
      expect(messageOf({ ...VALID, ...JIRA, JIRA_URL: 'http://127.0.0.1:4010' })).toBe('');
    });

    it('requires the username to look like an email', () => {
      const message = messageOf({ ...VALID, ...JIRA, JIRA_USERNAME: 'not-an-email' });
      expect(message).toContain('JIRA_USERNAME');
      expect(message).not.toContain('not-an-email');
    });

    it('never exposes the token through serialization or error messages', () => {
      const env = validateEnv({ ...VALID, ...JIRA });
      expect(JSON.stringify(env)).not.toContain(TOKEN);
      expect(String(env.JIRA_API_TOKEN)).not.toContain(TOKEN);
      expect(messageOf({ ...VALID, ...JIRA, JIRA_USERNAME: 'bad' })).not.toContain(TOKEN);
    });
  });

  it('rejects a missing database URL', () => {
    const withoutUrl: Record<string, unknown> = { ...VALID };
    delete withoutUrl.DATABASE_URL;
    expect(() => validateEnv(withoutUrl)).toThrow(/DATABASE_URL/);
  });
});
