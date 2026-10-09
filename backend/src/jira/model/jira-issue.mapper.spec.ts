import { jiraFixture } from '../../../test/utils/jira-fixtures';
import { JiraProtocolError } from '../errors';
import { JIRA_CONFIG } from '../jira.config';
import { isCompleted } from './jira-issue';
import { mapJiraIssue } from './jira-issue.mapper';

const SITE = 'https://acme.atlassian.net/';
const map = (name: string) => mapJiraIssue(jiraFixture(name), SITE);

describe('mapJiraIssue', () => {
  it('normalizes an epic', () => {
    const epic = map('epic');
    expect(epic).toMatchObject({
      id: '1',
      key: 'DEMO-1',
      summary: 'Demo epic',
      issueType: { id: '10000', hierarchyLevel: 1, isSubtask: false },
      projectKey: 'DEMO',
      parent: null,
      subtasks: [],
      url: 'https://acme.atlassian.net/browse/DEMO-1',
    });
  });

  it('keeps both story point fields, which may differ', () => {
    const story = map('story-with-subtasks');
    expect(story.storyPoints).toEqual({ final: 8, planned: 13 });
  });

  it('keeps null story points as null and a real 0 as 0', () => {
    expect(map('story-null-sp').storyPoints).toEqual({ final: null, planned: 1 });
    expect(map('task-no-subtasks').storyPoints).toEqual({ final: null, planned: null });
    expect(map('epic').storyPoints).toEqual({ final: null, planned: 0 });
  });

  it('maps parent and subtasks with their status categories', () => {
    const story = map('story-with-subtasks');
    expect(story.parent).toEqual({
      key: 'DEMO-1',
      summary: 'Demo epic',
      issueType: { id: '10000', name: 'Epic', hierarchyLevel: 1, isSubtask: false },
    });
    expect(story.subtasks.map((s) => [s.key, s.status.categoryKey, s.status.isCancelled])).toEqual([
      ['DEMO-3', 'done', false],
      ['DEMO-4', 'done', true],
      ['DEMO-5', 'new', false],
    ]);
    expect(map('task-no-subtasks').subtasks).toEqual([]);
  });

  it('maps a subtask by the subtask flag and hierarchy level', () => {
    const subtask = map('subtask');
    expect(subtask.issueType).toMatchObject({ isSubtask: true, hierarchyLevel: -1 });
    expect(subtask.parent?.key).toBe('DEMO-2');
    expect(subtask.storyPoints).toEqual({ final: 3, planned: 0 });
  });

  it('drives the type from id/hierarchyLevel, not from a localized name', () => {
    const localized = map('story-localized');
    expect(localized.issueType).toEqual({
      id: '10001',
      name: 'Historia',
      hierarchyLevel: 0,
      isSubtask: false,
    });
    expect(map('story-with-subtasks').issueType.id).toBe(localized.issueType.id);
  });

  it.each([
    ['status-new', 'new', false, false],
    ['status-indeterminate', 'indeterminate', false, false],
    ['status-done', 'done', false, true],
    ['status-cancelled', 'done', true, false],
  ])('classifies %s', (fixture, category, cancelled, completed) => {
    const { status } = map(fixture);
    expect(status.categoryKey).toBe(category);
    expect(status.isCancelled).toBe(cancelled);
    expect(isCompleted(status)).toBe(completed);
  });

  describe('isAvailable (D-025)', () => {
    const withStatus = (id: string, category: string) => {
      const payload = structuredClone(jiraFixture('status-new')) as {
        fields: { status: { id: string; statusCategory: { key: string } } };
      };
      payload.fields.status.id = id;
      payload.fields.status.statusCategory.key = category;
      return mapJiraIssue(payload, SITE).status;
    };

    it('is true only for the configured status id', () => {
      expect(withStatus('10068', 'new').isAvailable).toBe(true);
      expect(withStatus('1', 'new').isAvailable).toBe(false);
    });

    it('is never true for done or cancelled issues', () => {
      expect(withStatus('10068', 'done').isAvailable).toBe(false);
      expect(withStatus(JIRA_CONFIG.cancelledStatusId, 'done').isAvailable).toBe(false);
    });

    it('does not infer availability from the status name', () => {
      const payload = structuredClone(jiraFixture('status-new')) as {
        fields: { status: { name: string } };
      };
      payload.fields.status.name = 'Esperar Recurso';
      expect(mapJiraIssue(payload, SITE).status.isAvailable).toBe(false);
    });
  });

  it('does not infer cancellation from the status name', () => {
    const payload = structuredClone(jiraFixture('status-done')) as {
      fields: { status: { name: string } };
    };
    payload.fields.status.name = 'Cancelado';
    const { status } = mapJiraIssue(payload, SITE);
    expect(status.isCancelled).toBe(false);
    expect(isCompleted(status)).toBe(true);
  });

  it('maps an unrecognized or missing status category to unknown, never completed', () => {
    const payload = structuredClone(jiraFixture('status-done')) as {
      fields: { status: { statusCategory?: { key: string } } };
    };
    payload.fields.status.statusCategory = { key: 'weird' };
    expect(mapJiraIssue(payload, SITE).status.categoryKey).toBe('unknown');
    delete payload.fields.status.statusCategory;
    const { status } = mapJiraIssue(payload, SITE);
    expect(status.categoryKey).toBe('unknown');
    expect(isCompleted(status)).toBe(false);
  });

  it('rejects malformed payloads with a protocol error', () => {
    expect(() => map('malformed-issue')).toThrow(JiraProtocolError);
    expect(() => mapJiraIssue(undefined, SITE)).toThrow(JiraProtocolError);
    expect(() => mapJiraIssue('oops', SITE)).toThrow(JiraProtocolError);
  });

  it.each([['5'], [Number.NaN], [{}]])('rejects the story points value %p', (bad) => {
    const payload = structuredClone(jiraFixture('epic')) as { fields: Record<string, unknown> };
    payload.fields.customfield_10204 = bad;
    expect(() => mapJiraIssue(payload, SITE)).toThrow(JiraProtocolError);
  });
});
