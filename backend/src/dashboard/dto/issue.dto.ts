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

export const PROGRESS_BASES = ['subtasks', 'children', 'none'] as const;
export const PROGRESS_STATES = ['ok', 'none', 'all_cancelled'] as const;

export class ProgressDto {
  @ApiProperty({ enum: PROGRESS_BASES, description: 'What was counted; none = nothing applies.' })
  basis!: (typeof PROGRESS_BASES)[number];

  @ApiProperty({
    enum: PROGRESS_STATES,
    description:
      'ok = percent available; none = no data (never 0%); all_cancelled = all cancelled.',
  })
  state!: (typeof PROGRESS_STATES)[number];

  @ApiProperty({ description: 'Denominator (cancelled excluded by default, D-024).' })
  total!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  inProgress!: number;

  @ApiProperty()
  pending!: number;

  @ApiProperty({ description: 'Cancelled items, always reported separately.' })
  cancelled!: number;

  @ApiProperty({ description: 'Items with an unrecognized status category (never completed).' })
  unknown!: number;

  @ApiProperty({ type: Number, nullable: true, description: '0-100, one decimal; null = no data.' })
  percent!: number | null;

  @ApiProperty({ description: 'True when the children list was truncated at the hard cap.' })
  isApproximate!: boolean;
}

export class DashboardChildDto {
  @ApiProperty()
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

  @ApiProperty({ type: ProgressDto, description: 'Progress of the child by its own subtasks.' })
  progress!: ProgressDto;
}

/** Issue detail with progress; children only for epics. Weekly SP and dependencies are phase 5. */
export class DashboardIssueResponseDto {
  @ApiProperty({ type: DashboardIssueDto })
  issue!: DashboardIssueDto;

  @ApiProperty({ type: [DashboardSubtaskDto] })
  subtasks!: DashboardSubtaskDto[];

  @ApiProperty({ type: ProgressDto })
  progress!: ProgressDto;

  @ApiProperty({
    type: [DashboardChildDto],
    required: false,
    description: 'Direct children (epics only; absent otherwise).',
  })
  children?: DashboardChildDto[];

  @ApiProperty({ type: IssueDetailMetadataDto })
  metadata!: IssueDetailMetadataDto;
}
