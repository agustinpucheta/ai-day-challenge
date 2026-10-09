import { Inject, Injectable } from '@nestjs/common';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from './credentials/jira-credential-provider';
import type { JiraConnectionStatusDto, JiraConnectionVerifyDto } from './dto/jira-connection.dto';
import { JiraNotConfiguredError } from './errors';
import { toAppException } from './jira-error.mapper';
import { JiraGateway } from './jira.gateway';

/**
 * Connection state and verification for the HTTP layer.
 *
 * Jira-side failures never use HTTP 401/403: those mean "app session" / "forbidden origin"
 * to the frontend. Upstream credential problems are 424 (Failed Dependency) with a Jira code.
 */
@Injectable()
export class JiraConnectionService {
  constructor(
    @Inject(JIRA_CREDENTIAL_PROVIDER) private readonly credentials: JiraCredentialProvider,
    private readonly gateway: JiraGateway,
  ) {}

  /** No network call: only reports whether credentials are available. */
  async status(userId: string): Promise<JiraConnectionStatusDto> {
    try {
      const auth = await this.credentials.resolve(userId);
      return { mode: 'api_token', status: 'configured', siteUrl: auth.siteUrl };
    } catch (error) {
      if (error instanceof JiraNotConfiguredError) {
        return { mode: 'api_token', status: 'not_configured', siteUrl: null };
      }
      throw error;
    }
  }

  async verify(userId: string): Promise<JiraConnectionVerifyDto> {
    try {
      const info = await this.gateway.verifyConnection(userId);
      return { status: 'connected', ...info, checkedAt: new Date().toISOString() };
    } catch (error) {
      throw toAppException(error);
    }
  }
}
