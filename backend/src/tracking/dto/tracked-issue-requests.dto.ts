import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ISSUE_KEY_PATTERN } from '../../jira/jira-jql';

const trimAndUppercase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AddTrackedIssueDto {
  @ApiProperty({
    example: 'MASIN-123',
    description: 'Jira issue key. Trimmed and uppercased before validation.',
  })
  @Transform(trimAndUppercase)
  @IsString()
  @MaxLength(60)
  @Matches(ISSUE_KEY_PATTERN, { message: 'issueKey must be a valid Jira issue key' })
  issueKey!: string;
}

export class TrackedIssueIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}

export class ListTrackedIssuesQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true skips the in-memory cache and reads Jira again.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  refresh?: boolean;
}
