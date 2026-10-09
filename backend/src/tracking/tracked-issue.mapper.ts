import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { DashboardIssueResponseDto } from '../dashboard/dto/issue.dto';
import type {
  TrackedIssueErrorDto,
  TrackedIssueItemDto,
  TrackedIssueSummaryDto,
} from './dto/tracked-issue.dto';

/** What one successful Jira read contributes to a list item (also what the cache stores). */
export type LoadedIssue = Pick<
  TrackedIssueItemDto,
  'issue' | 'progress' | 'childrenCount' | 'warnings' | 'fetchedAt'
> & { issue: TrackedIssueSummaryDto };

export interface TrackedRow {
  id: string;
  issueKey: string;
  createdAt: Date;
}

/** Keeps the list-sized subset of the detail response. `fetchedAt` is the Jira read time. */
export function toLoadedIssue(detail: DashboardIssueResponseDto): LoadedIssue {
  const { issue } = detail;
  return {
    issue: {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      url: issue.url,
      storyPoints: issue.storyPoints,
    },
    progress: detail.progress,
    ...(detail.children !== undefined && { childrenCount: detail.children.length }),
    warnings: detail.metadata.warnings,
    fetchedAt: detail.metadata.fetchedAt,
  };
}

/**
 * Normalizes a per-item failure to `{ code, message }`. Known Jira failures arrive as
 * `AppException` with fixed messages; anything else is reported generically (no details leak).
 */
export function toItemError(error: unknown): TrackedIssueErrorDto {
  if (error instanceof AppException) {
    const body = error.getResponse() as { code?: unknown; message?: unknown };
    if (typeof body.code === 'string' && typeof body.message === 'string') {
      return { code: body.code, message: body.message };
    }
  }
  return { code: ErrorCode.INTERNAL_ERROR, message: 'The issue could not be loaded' };
}

export function toOkItem(row: TrackedRow, loaded: LoadedIssue): TrackedIssueItemDto {
  return {
    id: row.id,
    issueKey: row.issueKey,
    addedAt: row.createdAt.toISOString(),
    status: 'ok',
    ...loaded,
  };
}

/** An errored item carries no issue data and no progress (never fake zeros). */
export function toErrorItem(
  row: TrackedRow,
  error: TrackedIssueErrorDto,
  fetchedAt: string,
): TrackedIssueItemDto {
  return {
    id: row.id,
    issueKey: row.issueKey,
    addedAt: row.createdAt.toISOString(),
    status: 'error',
    fetchedAt,
    error,
  };
}
