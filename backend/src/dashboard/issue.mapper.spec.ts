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

  it('does not include metrics that Jira data cannot fill yet', () => {
    const dto = toDashboardIssueResponse(issue('story-with-subtasks'), FETCHED_AT);
    expect(Object.keys(dto).sort()).toEqual(['issue', 'metadata', 'subtasks']);
  });
});
