import { ApiProperty } from '@nestjs/swagger';

export const JIRA_CONNECTION_STATUSES = ['not_configured', 'configured'] as const;
export type JiraConnectionStatus = (typeof JIRA_CONNECTION_STATUSES)[number];

export class JiraConnectionStatusDto {
  @ApiProperty({ enum: ['api_token'], example: 'api_token' })
  mode!: 'api_token';

  @ApiProperty({ enum: JIRA_CONNECTION_STATUSES, example: 'configured' })
  status!: JiraConnectionStatus;

  @ApiProperty({ type: String, nullable: true, example: 'https://acme.atlassian.net' })
  siteUrl!: string | null;
}

export class JiraConnectionVerifyDto {
  @ApiProperty({ enum: ['connected'], example: 'connected' })
  status!: 'connected';

  @ApiProperty({ example: 'https://acme.atlassian.net' })
  siteUrl!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  displayName!: string;

  @ApiProperty({ format: 'date-time', description: 'When Jira was queried.' })
  checkedAt!: string;
}
