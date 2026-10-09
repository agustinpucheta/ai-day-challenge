import { jiraFixture } from '../../test/utils/jira-fixtures';
import { mapJiraIssue } from '../jira/model/jira-issue.mapper';
import { toDashboardIssueResponse, toIssueSummaryDto } from './issue.mapper';

const SITE = 'https://acme.atlassian.net';
const FETCHED_AT = '2026-10-09T12:00:00.000Z';
const issue = (name: string) => mapJiraIssue(jiraFixture(name), SITE);

describe('toIssueSummaryDto', () => {
  it('keeps only the summary fields and builds the browse url', () => {
    const dto = toIssueSummaryDto(issue('story-with-subtasks'));
    expect(dto).toEqual({
      key: 'DEMO-2',
      summary: 'Story with subtasks',
      issueType: { id: '10001', name: 'Story', hierarchyLevel: 0, isSubtask: false },
      status: { name: 'In progress', categoryKey: 'indeterminate', isCancelled: false },
      url: `${SITE}/browse/DEMO-2`,
    });
  });
});

describe('toDashboardIssueResponse', () => {
  it('maps both story point values, the parent key and the subtasks', () => {
    const dto = toDashboardIssueResponse(issue('story-with-subtasks'), FETCHED_AT);
    expect(dto.issue.storyPoints).toEqual({ final: 8, planned: 13 });
    expect(dto.issue.parentKey).toBe('DEMO-1');
    expect(dto.subtasks.map((s) => [s.key, s.status.categoryKey, s.status.isCancelled])).toEqual([
      ['DEMO-3', 'done', false],
      ['DEMO-4', 'done', true],
      ['DEMO-5', 'new', false],
    ]);
    expect(dto.subtasks[0]?.url).toBe(`${SITE}/browse/DEMO-3`);
    expect(dto.metadata).toEqual({ fetchedAt: FETCHED_AT, isStale: false, warnings: [] });
  });

  it('keeps a missing story point as null, never 0, and a missing parent as null', () => {
    const dto = toDashboardIssueResponse(issue('task-no-subtasks'), FETCHED_AT);
    expect(dto.issue.storyPoints).toEqual({ final: null, planned: null });
    expect(dto.issue.parentKey).toBeNull();
    expect(dto.subtasks).toEqual([]);
  });

  it('does not include weekly SP or dependencies yet (phase 5)', () => {
    const dto = toDashboardIssueResponse(issue('story-with-subtasks'), FETCHED_AT);
    expect(Object.keys(dto).sort()).toEqual(['issue', 'metadata', 'progress', 'subtasks']);
  });
});

describe('toDashboardIssueResponse progress and children', () => {
  const children = (...names: string[]) =>
    names
      .flatMap((name) => (jiraFixture(name) as { issues: unknown[] }).issues)
      .map((raw) => mapJiraIssue(raw, SITE));

  it('computes a story progress by its subtasks (cancelled excluded and reported)', () => {
    const dto = toDashboardIssueResponse(issue('story-with-subtasks'), FETCHED_AT);
    expect(dto.progress).toEqual({
      basis: 'subtasks',
      state: 'ok',
      total: 2,
      completed: 1,
      inProgress: 0,
      pending: 1,
      cancelled: 1,
      unknown: 0,
      percent: 50,
      isApproximate: false,
    });
    expect(dto).not.toHaveProperty('children');
  });

  it('reports "none" with a null percent for a story without subtasks', () => {
    const dto = toDashboardIssueResponse(issue('task-no-subtasks'), FETCHED_AT);
    expect(dto.progress).toMatchObject({
      basis: 'subtasks',
      state: 'none',
      total: 0,
      percent: null,
    });
  });

  it('reports basis none for a subtask', () => {
    const dto = toDashboardIssueResponse(issue('subtask'), FETCHED_AT);
    expect(dto.progress).toMatchObject({ basis: 'none', state: 'none', percent: null });
  });

  it('computes an epic progress by children, each child with its own subtask progress', () => {
    const dto = toDashboardIssueResponse(issue('epic'), FETCHED_AT, {
      children: children('children-page-1', 'children-last-page'),
      truncated: false,
    });
    expect(dto.progress).toMatchObject({
      basis: 'children',
      state: 'ok',
      total: 2,
      completed: 0,
      inProgress: 1,
      pending: 1,
      cancelled: 1,
      percent: 0,
      isApproximate: false,
    });
    expect(
      dto.children?.map((child) => [
        child.key,
        child.progress.basis,
        child.progress.state,
        child.progress.percent,
      ]),
    ).toEqual([
      ['DEMO-2', 'subtasks', 'ok', 50],
      ['DEMO-8', 'subtasks', 'none', null],
      ['DEMO-20', 'subtasks', 'none', null],
    ]);
    expect(dto.children?.[0]).toMatchObject({
      issueType: { name: 'Story' },
      url: `${SITE}/browse/DEMO-2`,
      storyPoints: { final: null, planned: null },
    });
    expect(dto.metadata.warnings).toEqual([]);
  });

  it('reports "none" for an epic without children and all_cancelled when all are cancelled', () => {
    const empty = toDashboardIssueResponse(issue('epic'), FETCHED_AT, {
      children: [],
      truncated: false,
    });
    expect(empty.progress).toMatchObject({ basis: 'children', state: 'none', percent: null });
    expect(empty.children).toEqual([]);
    const cancelled = toDashboardIssueResponse(issue('epic'), FETCHED_AT, {
      children: children('children-all-cancelled'),
      truncated: false,
    });
    expect(cancelled.progress).toMatchObject({
      state: 'all_cancelled',
      percent: null,
      cancelled: 2,
      total: 0,
    });
  });

  it('flags a truncated list as approximate with a warning', () => {
    const dto = toDashboardIssueResponse(issue('epic'), FETCHED_AT, {
      children: children('children-truncated-page'),
      truncated: true,
    });
    expect(dto.progress.isApproximate).toBe(true);
    expect(dto.metadata.warnings).toEqual([
      'Children list truncated at 300: progress is approximate',
    ]);
  });

  it('counts unknown subtask categories as unknown and warns', () => {
    const dto = toDashboardIssueResponse(issue('epic'), FETCHED_AT, {
      children: children('children-unknown-subtask'),
      truncated: false,
    });
    expect(dto.children?.[0]?.progress).toMatchObject({
      total: 2,
      completed: 1,
      unknown: 1,
      percent: 50,
    });
    expect(dto.metadata.warnings).toEqual([
      'DEMO-50: 1 subtasks with an unknown status category (not counted as completed)',
    ]);
  });
});
