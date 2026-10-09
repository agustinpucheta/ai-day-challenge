import { JIRA_CONFIG } from '../jira/jira.config';
import type { JiraIssue, JiraStatus } from '../jira/model/jira-issue';
import { computeProgress, type ProgressBasis } from '../metrics/progress';
import type {
  DashboardChildDto,
  DashboardIssueResponseDto,
  IssueStatusDto,
  IssueSummaryDto,
  ProgressDto,
} from './dto/issue.dto';

export function toStatusDto(status: JiraStatus): IssueStatusDto {
  return {
    name: status.name,
    categoryKey: status.categoryKey,
    isCancelled: status.isCancelled,
  };
}

export function toIssueSummaryDto(issue: JiraIssue): IssueSummaryDto {
  return {
    key: issue.key,
    summary: issue.summary,
    issueType: { ...issue.issueType },
    status: toStatusDto(issue.status),
    url: issue.url,
  };
}

/** Resolved children of an epic. `truncated` means the hard cap was hit (partial list). */
export interface ChildrenInput {
  children: JiraIssue[];
  truncated: boolean;
}

const NO_PROGRESS: ProgressDto = {
  basis: 'none',
  state: 'none',
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  cancelled: 0,
  unknown: 0,
  percent: null,
  isApproximate: false,
};

function toProgressDto(
  items: Array<{ key: string; status: JiraStatus }>,
  basis: ProgressBasis,
  isApproximate = false,
): ProgressDto {
  return { ...computeProgress(items, { basis }), isApproximate };
}

/** Progress of an issue by its own subtasks. A subtask has nothing to measure. */
function subtaskProgress(issue: JiraIssue): ProgressDto {
  return issue.issueType.isSubtask ? NO_PROGRESS : toProgressDto(issue.subtasks, 'subtasks');
}

function unknownWarning(key: string, progress: ProgressDto, noun: string): string[] {
  return progress.unknown > 0
    ? [
        `${key}: ${progress.unknown} ${noun} with an unknown status category (not counted as completed)`,
      ]
    : [];
}

function toChildDto(child: JiraIssue): DashboardChildDto {
  return {
    key: child.key,
    summary: child.summary,
    issueType: { ...child.issueType },
    status: toStatusDto(child.status),
    url: child.url,
    storyPoints: { final: child.storyPoints.final, planned: child.storyPoints.planned },
    progress: subtaskProgress(child),
  };
}

/**
 * Story points keep `null` for "no estimate". Progress is by subtasks, or by direct children
 * for an epic (`childrenInput` present); each child carries its own subtask progress.
 */
export function toDashboardIssueResponse(
  issue: JiraIssue,
  fetchedAt: string,
  childrenInput?: ChildrenInput,
): DashboardIssueResponseDto {
  const warnings: string[] = [];
  const children = childrenInput?.children.map(toChildDto);
  let progress: ProgressDto;
  if (childrenInput !== undefined && children !== undefined) {
    progress = toProgressDto(childrenInput.children, 'children', childrenInput.truncated);
    warnings.push(...unknownWarning(issue.key, progress, 'children'));
    for (const child of children)
      warnings.push(...unknownWarning(child.key, child.progress, 'subtasks'));
    if (childrenInput.truncated) {
      warnings.push(
        `Children list truncated at ${JIRA_CONFIG.children.pageSize * JIRA_CONFIG.children.maxPages}: progress is approximate`,
      );
    }
  } else {
    progress = subtaskProgress(issue);
    warnings.push(...unknownWarning(issue.key, progress, 'subtasks'));
  }
  return {
    issue: {
      id: issue.id,
      key: issue.key,
      summary: issue.summary,
      issueType: { ...issue.issueType },
      status: toStatusDto(issue.status),
      url: issue.url,
      parentKey: issue.parent?.key ?? null,
      storyPoints: { final: issue.storyPoints.final, planned: issue.storyPoints.planned },
    },
    subtasks: issue.subtasks.map((subtask) => ({
      key: subtask.key,
      summary: subtask.summary,
      status: toStatusDto(subtask.status),
      url: subtask.url,
    })),
    progress,
    ...(children !== undefined && { children }),
    metadata: { fetchedAt, isStale: false, warnings },
  };
}
