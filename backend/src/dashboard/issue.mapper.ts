import type { JiraIssue, JiraStatus } from '../jira/model/jira-issue';
import type { DashboardIssueResponseDto, IssueStatusDto, IssueSummaryDto } from './dto/issue.dto';

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

/** Story points keep `null` for "no estimate". Progress, weekly SP and dependencies are not F3. */
export function toDashboardIssueResponse(
  issue: JiraIssue,
  fetchedAt: string,
): DashboardIssueResponseDto {
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
    metadata: { fetchedAt, isStale: false, warnings: [] },
  };
}
