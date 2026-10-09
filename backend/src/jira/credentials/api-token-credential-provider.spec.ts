import { inspect } from 'node:util';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { type Env, validateEnv } from '../../config/env';
import { Secret } from '../../config/secret';
import { JiraNotConfiguredError } from '../errors';
import {
  ApiTokenCredentialProvider,
  apiTokenProviderFromConfig,
} from './api-token-credential-provider';

const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-super-secret-token-value';
const B64 = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');

describe('ApiTokenCredentialProvider', () => {
  const provider = new ApiTokenCredentialProvider({
    url: 'https://acme.atlassian.net',
    username: EMAIL,
    token: new Secret(TOKEN),
  });

  it('resolves the same instance identity for any user', async () => {
    const a = await provider.resolve('user-a');
    const b = await provider.resolve('user-b');
    expect(a.baseUrl).toBe('https://acme.atlassian.net');
    expect(a.siteUrl).toBe('https://acme.atlassian.net');
    expect(a.headers()).toEqual(b.headers());
  });

  it('builds a Basic Authorization header from email:token', async () => {
    const auth = await provider.resolve('user-a');
    expect(auth.headers()).toEqual({ authorization: `Basic ${B64}` });
  });

  it('keeps the token and the header out of every serialization of the request auth', async () => {
    const auth = await provider.resolve('user-a');
    const rendered = [JSON.stringify(auth), inspect(auth, { depth: 5 }), Object.keys(auth).join()];
    for (const text of rendered) {
      for (const secret of [TOKEN, EMAIL, B64]) expect(text).not.toContain(secret);
    }
    expect(JSON.stringify(provider)).not.toContain(TOKEN);
  });

  it('rejects with JiraNotConfiguredError when there are no credentials', async () => {
    await expect(new ApiTokenCredentialProvider(null).resolve('user-a')).rejects.toBeInstanceOf(
      JiraNotConfiguredError,
    );
  });
});

describe('apiTokenProviderFromConfig', () => {
  const BASE = {
    WEB_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    SESSION_SECRET: 'x'.repeat(32),
  };
  const VARS = ['JIRA_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN'] as const;

  async function configWith(raw: Record<string, string>): Promise<ConfigService<Env, true>> {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          validate: () => validateEnv({ ...BASE, ...raw }),
        }),
      ],
    }).compile();
    return moduleRef.get<ConfigService<Env, true>>(ConfigService);
  }

  afterEach(() => {
    for (const name of VARS) delete process.env[name];
  });

  it('builds a working provider from validated variables', async () => {
    const config = await configWith({
      JIRA_URL: 'https://acme.atlassian.net/jira/',
      JIRA_USERNAME: EMAIL,
      JIRA_API_TOKEN: TOKEN,
    });
    const auth = await apiTokenProviderFromConfig(config).resolve('user-a');
    expect(auth.baseUrl).toBe('https://acme.atlassian.net');
    expect(auth.headers()).toEqual({ authorization: `Basic ${B64}` });
  });

  it('stays unconfigured when the variables are empty in process.env (JIRA_URL= in .env)', async () => {
    for (const name of VARS) process.env[name] = '';
    const config = await configWith({});
    await expect(apiTokenProviderFromConfig(config).resolve('user-a')).rejects.toBeInstanceOf(
      JiraNotConfiguredError,
    );
  });
});
