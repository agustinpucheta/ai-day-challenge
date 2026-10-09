import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from './credentials/jira-credential-provider';
import type { JiraConnectionStatusDto, JiraConnectionVerifyDto } from './dto/jira-connection.dto';
import {
  JiraForbiddenError,
  JiraNotConfiguredError,
  JiraProtocolError,
  JiraRateLimitedError,
  JiraUnauthorizedError,
  JiraUnavailableError,
} from './errors';
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

function toAppException(error: unknown): unknown {
  if (error instanceof JiraNotConfiguredError) {
    return new AppException(
      409,
      ErrorCode.JIRA_NOT_CONNECTED,
      'Jira credentials are not configured',
    );
  }
  if (error instanceof JiraUnauthorizedError) {
    return new AppException(
      424,
      ErrorCode.JIRA_REAUTH_REQUIRED,
      'Jira rejected the API token. Create a new token and replace JIRA_API_TOKEN',
    );
  }
  if (error instanceof JiraForbiddenError) {
    return new AppException(424, ErrorCode.JIRA_FORBIDDEN, 'The Jira account lacks permission');
  }
  if (error instanceof JiraRateLimitedError) {
    return new AppException(
      429,
      ErrorCode.JIRA_RATE_LIMITED,
      'Jira rate limit reached, try again later',
      undefined,
      error.retryAfterSeconds,
    );
  }
  if (error instanceof JiraUnavailableError || error instanceof JiraProtocolError) {
    return new AppException(
      503,
      ErrorCode.JIRA_UNAVAILABLE,
      'Jira is unavailable, try again later',
    );
  }
  return error;
}
