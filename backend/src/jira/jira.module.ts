import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { apiTokenProviderFromConfig } from './credentials/api-token-credential-provider';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from './credentials/jira-credential-provider';
import { JiraConnectionController } from './jira-connection.controller';
import { JiraConnectionService } from './jira-connection.service';
import { JiraOAuthModule } from './jira-oauth.module';
import { JiraGateway } from './jira.gateway';

@Module({
  imports: [JiraOAuthModule],
  controllers: [JiraConnectionController],
  providers: [
    {
      // Single-user API token mode (D-023). A per-user OAuth provider can replace this binding.
      provide: JIRA_CREDENTIAL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): JiraCredentialProvider =>
        apiTokenProviderFromConfig(config),
    },
    JiraGateway,
    JiraConnectionService,
  ],
  exports: [JIRA_CREDENTIAL_PROVIDER, JiraGateway],
})
export class JiraModule {}
