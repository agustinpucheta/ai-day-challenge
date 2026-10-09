import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import type { Env } from '../config/env';
import { CryptoModule } from '../crypto/crypto.module';
import { JiraConnectionsService } from './connections/jira-connections.service';
import { AtlassianOAuthClient } from './oauth/atlassian-oauth.client';
import { FetchHttpPort, HTTP_PORT, type HttpPort } from './oauth/http-port';
import { OAuthStateService } from './oauth/oauth-state.service';

@Module({
  imports: [CryptoModule, AuditModule],
  providers: [
    OAuthStateService,
    JiraConnectionsService,
    { provide: HTTP_PORT, useFactory: (): HttpPort => new FetchHttpPort() },
    {
      provide: AtlassianOAuthClient,
      inject: [ConfigService, HTTP_PORT],
      // Unconfigured OAuth yields a client that throws JiraOAuthNotConfiguredError on use.
      useFactory: (config: ConfigService<Env, true>, http: HttpPort) => {
        const get = <K extends keyof Env>(key: K): Env[K] => config.get(key, { infer: true });
        const clientId = get('ATLASSIAN_CLIENT_ID');
        const clientSecret = get('ATLASSIAN_CLIENT_SECRET');
        const redirectUri = get('ATLASSIAN_REDIRECT_URI');
        const configured =
          get('jiraOAuthConfigured') &&
          clientId !== undefined &&
          clientSecret !== undefined &&
          redirectUri !== undefined;
        return new AtlassianOAuthClient(
          configured
            ? {
                clientId,
                clientSecret,
                redirectUri,
                scopes: get('ATLASSIAN_SCOPES'),
                authBaseUrl: get('ATLASSIAN_AUTH_BASE_URL'),
                apiBaseUrl: get('ATLASSIAN_API_BASE_URL'),
              }
            : null,
          http,
        );
      },
    },
  ],
  exports: [OAuthStateService, JiraConnectionsService, AtlassianOAuthClient, HTTP_PORT],
})
export class JiraOAuthModule {}
