import { TrackedIssueCache } from './tracked-issue.cache';
import type { LoadedIssue } from './tracked-issue.mapper';

const SITE = 'https://acme.atlassian.net';

function loaded(key: string, fetchedAt = '2026-10-09T10:00:00.000Z'): LoadedIssue {
  return {
    issue: {
      key,
      summary: key,
      issueType: { id: '1', name: 'Story', hierarchyLevel: 0, isSubtask: false },
      status: { name: 'To do', categoryKey: 'new', isCancelled: false },
      url: `${SITE}/browse/${key}`,
      storyPoints: { final: null, planned: null },
    },
    fetchedAt,
  };
}

describe('TrackedIssueCache', () => {
  let now = 1_000;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000;
  });

  it('serves an entry within the TTL with its original fetchedAt and expires it after', () => {
    const cache = new TrackedIssueCache(60_000, 10, clock);
    cache.set('u1', SITE, 'DEMO-1', loaded('DEMO-1', 'original'));
    now += 59_999;
    expect(cache.get('u1', SITE, 'DEMO-1')?.fetchedAt).toBe('original');
    now += 1;
    expect(cache.get('u1', SITE, 'DEMO-1')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('never shares entries across users or sites', () => {
    const cache = new TrackedIssueCache(60_000, 10, clock);
    cache.set('u1', SITE, 'DEMO-1', loaded('DEMO-1'));
    expect(cache.get('u2', SITE, 'DEMO-1')).toBeUndefined();
    expect(cache.get('u1', 'https://other.atlassian.net', 'DEMO-1')).toBeUndefined();
    expect(cache.get('u1', SITE, 'DEMO-2')).toBeUndefined();
    expect(cache.get('u1', SITE, 'DEMO-1')).toBeDefined();
  });

  it('deletes an entry and evicts the oldest past the size bound', () => {
    const cache = new TrackedIssueCache(60_000, 2, clock);
    cache.set('u1', SITE, 'A-1', loaded('A-1'));
    cache.set('u1', SITE, 'A-2', loaded('A-2'));
    cache.set('u1', SITE, 'A-3', loaded('A-3'));
    expect(cache.get('u1', SITE, 'A-1')).toBeUndefined();
    expect(cache.size).toBe(2);
    cache.delete('u1', SITE, 'A-2');
    expect(cache.get('u1', SITE, 'A-2')).toBeUndefined();
  });
});
