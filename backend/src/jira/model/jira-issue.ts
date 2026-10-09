import { JIRA_CONFIG, type JiraStatusCategoryKey } from '../jira.config';

export interface JiraIssueType {
  id: string;
  /** Localized display name: informational, never used for classification. */
  name: string;
  hierarchyLevel: number;
  isSubtask: boolean;
}

export interface JiraStatus {
  id: string;
  name: string;
  categoryKey: JiraStatusCategoryKey | 'unknown';
  isCancelled: boolean;
}

export interface JiraSubtaskRef {
  key: string;
  summary: string;
  status: JiraStatus;
  url: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  issueType: JiraIssueType;
  status: JiraStatus;
  /** `null` means "no estimate" and is never coerced to 0. */
  storyPoints: { final: number | null; planned: number | null };
  parent: { key: string; summary?: string; issueType?: JiraIssueType } | null;
  subtasks: JiraSubtaskRef[];
  url: string;
  projectKey: string;
}

export interface JiraIssuePage {
  issues: JiraIssue[];
  nextPageToken: string | null;
  fetchedAt: string;
}

export interface JiraIssueResult {
  issue: JiraIssue;
  fetchedAt: string;
}

/** Completed means category `done` and not the configured cancelled status (D-014). */
export function isCompleted(status: Pick<JiraStatus, 'categoryKey' | 'isCancelled'>): boolean {
  return status.categoryKey === JIRA_CONFIG.doneCategoryKey && !status.isCancelled;
}
