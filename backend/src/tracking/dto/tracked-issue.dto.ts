import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssueStatusDto,
  IssueTypeDto,
  ProgressDto,
  StoryPointsDto,
} from '../../dashboard/dto/issue.dto';

export const TRACKED_ITEM_STATUSES = ['ok', 'error'] as const;

export class TrackedIssueEntryDto {
  @ApiProperty({ format: 'uuid', description: 'Id of the tracking entry (not the Jira issue id).' })
  id!: string;

  @ApiProperty({ example: 'MASIN-123' })
  issueKey!: string;

  @ApiProperty({ format: 'date-time' })
  addedAt!: string;
}

export class TrackedIssueSummaryDto {
  @ApiProperty({ example: 'MASIN-123' })
  key!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: IssueTypeDto })
  issueType!: IssueTypeDto;

  @ApiProperty({ type: IssueStatusDto })
  status!: IssueStatusDto;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: StoryPointsDto })
  storyPoints!: StoryPointsDto;
}

export class TrackedIssueErrorDto {
  @ApiProperty({
    example: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE',
    description: 'Normalized code (same set as the endpoint errors).',
  })
  code!: string;

  @ApiProperty()
  message!: string;
}

/** One followed issue: loaded from Jira (`ok`) or a normalized per-item failure (`error`). */
export class TrackedIssueItemDto extends TrackedIssueEntryDto {
  @ApiProperty({ enum: TRACKED_ITEM_STATUSES })
  status!: (typeof TRACKED_ITEM_STATUSES)[number];

  @ApiPropertyOptional({ type: TrackedIssueSummaryDto, description: 'Only when status is ok.' })
  issue?: TrackedIssueSummaryDto;

  @ApiPropertyOptional({
    type: ProgressDto,
    description: 'Only when status is ok. Never present (not even zeros) for an errored item.',
  })
  progress?: ProgressDto;

  @ApiPropertyOptional({ description: 'Direct children count; epics with status ok only.' })
  childrenCount?: number;

  @ApiPropertyOptional({ type: [String], description: 'Only when status is ok.' })
  warnings?: string[];

  @ApiProperty({
    format: 'date-time',
    description:
      'When Jira was read for this item. A cached item keeps its original read time; for an error it is the attempt time.',
  })
  fetchedAt!: string;

  @ApiPropertyOptional({ type: TrackedIssueErrorDto, description: 'Only when status is error.' })
  error?: TrackedIssueErrorDto;
}

export class TrackedIssuesMetadataDto {
  @ApiProperty({ format: 'date-time', description: 'When this list was assembled.' })
  fetchedAt!: string;
}

export class TrackedIssuesResponseDto {
  @ApiProperty({ type: [TrackedIssueItemDto], description: 'Ordered by display order.' })
  items!: TrackedIssueItemDto[];

  @ApiProperty({ type: TrackedIssuesMetadataDto })
  metadata!: TrackedIssuesMetadataDto;
}
