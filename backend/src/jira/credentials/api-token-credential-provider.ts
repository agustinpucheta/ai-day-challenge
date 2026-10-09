import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { Secret } from '../../config/secret';
import { JiraNotConfiguredError } from '../errors';
import type { JiraCredentialProvider, JiraRequestAuth } from './jira-credential-provider';

export interface ApiTokenSettings {
  /** Normalized Jira site origin. */
  url: string;
  /** Account email. */
  username: string;
  token: Secret;
}

class ApiTokenRequestAuth implements JiraRequestAuth {
  readonly #username: string;
  readonly #token: Secret;

  constructor(
    readonly baseUrl: string,
    readonly siteUrl: string,
    username: string,
    token: Secret,
  ) {
    this.#username = username;
    this.#token = token;
  }

  headers(): Record<string, string> {
    const credentials = Buffer.from(`${this.#username}:${this.#token.reveal()}`).toString('base64');
    return { authorization: `Basic ${credentials}` };
  }
}

/**
 * Single-user mode (D-023): the instance owner's Jira Cloud API token from the environment.
 * Every authenticated local user shares this identity; `userId` is accepted so per-user
 * providers (OAuth) can replace this one later.
 */
export class ApiTokenCredentialProvider implements JiraCredentialProvider {
  readonly #settings: ApiTokenSettings | null;

  constructor(settings: ApiTokenSettings | null) {
    this.#settings = settings;
  }

  // `userId` is reserved for per-user providers; the instance identity is shared here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolve(_userId: string): Promise<JiraRequestAuth> {
    if (this.#settings === null) return Promise.reject(new JiraNotConfiguredError());
    const { url, username, token } = this.#settings;
    return Promise.resolve(new ApiTokenRequestAuth(url, url, username, token));
  }
}

/**
 * Builds the provider from validated config. Guards on the derived `jiraApiTokenConfigured`
 * flag: `ConfigService.get` falls back to the raw `process.env` (for example `JIRA_URL=`
 * from .env) when the validated value is undefined, so the raw values must not decide.
 */
export function apiTokenProviderFromConfig(
  config: ConfigService<Env, true>,
): ApiTokenCredentialProvider {
  const url = config.get('JIRA_URL', { infer: true });
  const username = config.get('JIRA_USERNAME', { infer: true });
  const token = config.get('JIRA_API_TOKEN', { infer: true });
  const configured = config.get('jiraApiTokenConfigured', { infer: true });
  if (!configured || !url || !username || !token) return new ApiTokenCredentialProvider(null);
  return new ApiTokenCredentialProvider({ url, username, token });
}
