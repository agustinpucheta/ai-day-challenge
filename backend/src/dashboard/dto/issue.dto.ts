import { ApiProperty } from '@nestjs/swagger';

export const STATUS_CATEGORY_KEYS = ['new', 'indeterminate', 'done', 'unknown'] as const;
export type StatusCategoryKey = (typeof STATUS_CATEGORY_KEYS)[number];

export class IssueTypeDto {
  @ApiProperty({ example: '10001', description: 'Issue type id (names are localized).' })
  id!: string;

  @ApiProperty({ example: 'Story' })
  name!: string;

  @ApiProperty({ example: 0 })
  hierarchyLevel!: number;

  @ApiProperty()
  isSubtask!: boolean;
}

export class IssueStatusDto {
  @ApiProperty({ example: 'In progress' })
  name!: string;

  @ApiProperty({ enum: STATUS_CATEGORY_KEYS })
  categoryKey!: StatusCategoryKey;

  @ApiProperty({ description: 'The configured cancelled status (done category, not completed).' })
  isCancelled!: boolean;
}

export class IssueMetadataDto {
  @ApiProperty({ format: 'date-time', description: 'When Jira was queried.' })
  fetchedAt!: string;

  @ApiProperty({ example: false, description: 'Always false: data is read live from Jira.' })
  isStale!: boolean;
}

export class IssueDetailMetadataDto extends IssueMetadataDto {
  @ApiProperty({ type: [String] })
  warnings!: string[];
}

export class IssueSummaryDto {
  @ApiProperty({ example: 'MASIN-123' })
  key!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: IssueTypeDto })
  issueType!: IssueTypeDto;

  @ApiProperty({ type: IssueStatusDto })
  status!: IssueStatusDto;

  @ApiProperty({ example: 'https://acme.atlassian.net/browse/MASIN-123' })
  url!: string;
}

export class IssueSearchResponseDto {
  @ApiProperty({ type: [IssueSummaryDto] })
  items!: IssueSummaryDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Opaque cursor for the next page; null on the last page.',
  })
  nextPageToken!: string | null;

  @ApiProperty({ type: IssueMetadataDto })
  metadata!: IssueMetadataDto;
}

export class StoryPointsDto {
  @ApiProperty({ type: Number, nullable: true, description: 'Final SP; null means no estimate.' })
  final!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Planned SP; null means no estimate.' })
  planned!: number | null;
}

export class DashboardIssueDto {
  @ApiProperty()
  id!: string;

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

  @ApiProperty({ type: String, nullable: true })
  parentKey!: string | null;

  @ApiProperty({ type: StoryPointsDto })
  storyPoints!: StoryPointsDto;
}

export class DashboardSubtaskDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  summary!: string;

  @ApiProperty({ type: IssueStatusDto })
  status!: IssueStatusDto;

  @ApiProperty()
  url!: string;
}

/** Only what Jira data fills truthfully today; progress, weekly SP and dependencies are phases 4-5. */
export class DashboardIssueResponseDto {
  @ApiProperty({ type: DashboardIssueDto })
  issue!: DashboardIssueDto;

  @ApiProperty({ type: [DashboardSubtaskDto] })
  subtasks!: DashboardSubtaskDto[];

  @ApiProperty({ type: IssueDetailMetadataDto })
  metadata!: IssueDetailMetadataDto;
}
