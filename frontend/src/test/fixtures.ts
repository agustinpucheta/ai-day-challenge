import type { Progress } from '@/api/client';

/** Sentinels the UI must never render: they only exist in mocks to catch leaks. */
export const SECRET = 'ATATT-secret-token-value';
export const EMAIL = 'owner@example.com';

/** 7 of 12 done: a regular story with subtasks. */
export function progress(overrides: Partial<Progress> = {}): Progress {
  return {
    basis: 'subtasks',
    state: 'ok',
    total: 12,
    completed: 7,
    inProgress: 3,
    pending: 2,
    cancelled: 1,
    unknown: 0,
    percent: 58.3,
    isApproximate: false,
    ...overrides,
  };
}

export const NO_SUBTASKS: Progress = progress({
  state: 'none',
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  cancelled: 0,
  percent: null,
});

export const NO_CHILDREN: Progress = { ...NO_SUBTASKS, basis: 'children' };

export const ALL_CANCELLED: Progress = progress({
  state: 'all_cancelled',
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  cancelled: 3,
  percent: null,
});

export const storyType = { id: '10001', name: 'Story', hierarchyLevel: 0, isSubtask: false };
export const epicType = { id: '10000', name: 'Epic', hierarchyLevel: 1, isSubtask: false };

export const inProgressStatus = {
  name: 'In Progress',
  categoryKey: 'indeterminate',
  isCancelled: false,
};

export function jiraUrl(key: string): string {
  return `https://acme.atlassian.net/browse/${key}`;
}

export const FETCHED_AT = '2026-10-09T12:00:00.000Z';
export const LIST_AT = '2026-10-09T12:30:00.000Z';

/** A tracked item whose Jira read succeeded; `leakedToken` must never reach the DOM. */
export function okItem(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `id-${key}`,
    issueKey: key,
    addedAt: FETCHED_AT,
    status: 'ok',
    fetchedAt: FETCHED_AT,
    issue: {
      key,
      summary: `Summary of ${key}`,
      issueType: storyType,
      status: inProgressStatus,
      url: jiraUrl(key),
      storyPoints: { final: null, planned: 3 },
      leakedToken: SECRET,
      accountEmail: EMAIL,
    },
    progress: progress(),
    ...overrides,
  };
}

export function epicItem(key: string, childrenCount: number, overrides = {}) {
  const base = okItem(key);
  return okItem(key, {
    issue: { ...base.issue, issueType: epicType, storyPoints: { final: null, planned: null } },
    progress: progress({ basis: 'children' }),
    childrenCount,
    ...overrides,
  });
}

/** A tracked item whose Jira read failed: no `issue`, no `progress`. */
export function errorItem(key: string, code = 'JIRA_UNAVAILABLE') {
  return {
    id: `id-${key}`,
    issueKey: key,
    addedAt: FETCHED_AT,
    status: 'error',
    fetchedAt: FETCHED_AT,
    error: { code, message: `server says ${code}` },
  };
}

export function listBody(items: unknown[], fetchedAt = LIST_AT) {
  return { items, metadata: { fetchedAt } };
}

/** `GET /dashboard/issues/:key` body; pass `children` to make it an epic. */
export function detailBody(
  key: string,
  options: {
    summary?: string;
    progress?: Progress;
    children?: unknown[];
    warnings?: string[];
    storyPoints?: { final: number | null; planned: number | null };
  } = {},
) {
  const isEpic = options.children !== undefined;
  return {
    issue: {
      id: '10001',
      key,
      summary: options.summary ?? `Summary of ${key}`,
      issueType: isEpic ? epicType : storyType,
      status: inProgressStatus,
      url: jiraUrl(key),
      parentKey: null,
      storyPoints: options.storyPoints ?? { final: 3, planned: 3 },
      accountEmail: EMAIL,
      token: SECRET,
    },
    subtasks: [],
    progress: options.progress ?? progress(),
    ...(isEpic ? { children: options.children } : {}),
    metadata: { fetchedAt: FETCHED_AT, isStale: false, warnings: options.warnings ?? [] },
  };
}

export function childBody(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    summary: `Summary of ${key}`,
    issueType: storyType,
    status: inProgressStatus,
    url: jiraUrl(key),
    storyPoints: { final: null, planned: 5 },
    progress: progress(),
    ...overrides,
  };
}

/** A Jira-style error response as the backend sends it. */
export function errorResponse(status: number, code: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ code, message: `server says ${code}` }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
