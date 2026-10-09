import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch } from '@/test/http';
import { resetTracking, useTracking } from './useTracking';

const LIST = 'GET /api/v1/users/me/tracked-issues';
const ADD = 'POST /api/v1/users/me/tracked-issues';
const remove = (id: string) => `DELETE /api/v1/users/me/tracked-issues/${id}`;
const FETCHED_AT = '2026-10-09T12:00:00.000Z';

const listOf = (...entries: [id: string, key: string, status?: 'ok' | 'error'][]) =>
  jsonResponse(200, {
    items: entries.map(([id, issueKey, status = 'ok']) => ({
      id,
      issueKey,
      addedAt: FETCHED_AT,
      status,
      fetchedAt: FETCHED_AT,
    })),
    metadata: { fetchedAt: FETCHED_AT },
  });

const entry = (id: string, issueKey: string) => ({ id, issueKey, addedAt: FETCHED_AT });

const failure = (status: number, code: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ code, message: `server says ${code}` }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('useTracking', () => {
  beforeEach(() => resetTracking());
  afterEach(() => vi.unstubAllGlobals());

  describe('loading', () => {
    it('loads the followed keys once, including items whose Jira read failed', async () => {
      const calls = stubFetch({
        [LIST]: () => listOf(['e1', 'MASIN-1'], ['e2', 'MASIN-2', 'error']),
      });
      const tracking = useTracking();

      expect(tracking.loadState.value).toBe('idle');
      await Promise.all([tracking.ensureLoaded(), tracking.ensureLoaded()]);
      await tracking.ensureLoaded();

      expect(calls).toHaveLength(1);
      expect(tracking.loadState.value).toBe('ready');
      expect(tracking.isTracked('MASIN-1')).toBe(true);
      expect(tracking.isTracked('MASIN-2')).toBe(true);
      expect(tracking.isTracked('MASIN-3')).toBe(false);
    });

    it('reports a failed load and retries it on the next call', async () => {
      let attempt = 0;
      const calls = stubFetch({
        [LIST]: () =>
          ++attempt === 1 ? failure(503, 'JIRA_UNAVAILABLE') : listOf(['e1', 'MASIN-1']),
      });
      const tracking = useTracking();

      await tracking.ensureLoaded();
      expect(tracking.loadState.value).toBe('error');
      expect(tracking.isTracked('MASIN-1')).toBe(false);

      await tracking.ensureLoaded();
      expect(tracking.loadState.value).toBe('ready');
      expect(tracking.isTracked('MASIN-1')).toBe(true);
      expect(calls).toHaveLength(2);
    });

    it('keeps an entry added while the list was in flight', async () => {
      let releaseList: (response: Response) => void = () => undefined;
      stubFetch({
        [LIST]: () =>
          new Promise<Response>((resolve) => {
            releaseList = resolve;
          }),
        [ADD]: () => jsonResponse(201, entry('e9', 'MASIN-9')),
      });
      const tracking = useTracking();
      const loading = tracking.ensureLoaded();

      await tracking.track('MASIN-9');
      releaseList(listOf(['e1', 'MASIN-1']));
      await loading;

      expect(tracking.isTracked('MASIN-1')).toBe(true);
      expect(tracking.isTracked('MASIN-9')).toBe(true);
    });

    it('replaces its knowledge with an authoritative list from the dashboard', () => {
      const tracking = useTracking();
      tracking.beginSync().apply([{ id: 'e1', issueKey: 'MASIN-1' }]);
      tracking.beginSync().apply([{ id: 'e2', issueKey: 'MASIN-2' }]);

      expect(tracking.isTracked('MASIN-1')).toBe(false);
      expect(tracking.isTracked('MASIN-2')).toBe(true);
      expect(tracking.loadState.value).toBe('ready');
    });
  });

  describe('track', () => {
    it('sends the key and marks it tracked only after the server confirms', async () => {
      let release: (response: Response) => void = () => undefined;
      const calls = stubFetch({
        [ADD]: () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      });
      const tracking = useTracking();

      const pending = tracking.track('MASIN-1');
      expect(tracking.isPending('MASIN-1')).toBe(true);
      expect(tracking.isTracked('MASIN-1')).toBe(false);

      release(jsonResponse(201, entry('e1', 'MASIN-1')));
      await expect(pending).resolves.toBe(true);

      expect(calls[0]?.body).toEqual({ issueKey: 'MASIN-1' });
      expect(tracking.isPending('MASIN-1')).toBe(false);
      expect(tracking.isTracked('MASIN-1')).toBe(true);
      expect(tracking.errorFor('MASIN-1')).toBeNull();
    });

    it('treats "already tracked" (200) as success', async () => {
      stubFetch({ [ADD]: () => jsonResponse(200, entry('e1', 'MASIN-1')) });
      const tracking = useTracking();

      await expect(tracking.track('MASIN-1')).resolves.toBe(true);

      expect(tracking.isTracked('MASIN-1')).toBe(true);
    });

    it('ignores a second request for the same key while one is pending', async () => {
      const calls = stubFetch({ [ADD]: () => new Promise<Response>(() => undefined) });
      const tracking = useTracking();

      void tracking.track('MASIN-1');
      await expect(tracking.track('MASIN-1')).resolves.toBe(false);

      expect(calls).toHaveLength(1);
    });

    it.each([
      [409, 'TRACKING_LIMIT_REACHED', 'You can track up to 50 issues'],
      [404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE', 'Issue not found or no access'],
      [409, 'JIRA_NOT_CONNECTED', 'Jira is not configured'],
      [424, 'JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
      [424, 'JIRA_FORBIDDEN', 'Jira denied access'],
      [429, 'JIRA_RATE_LIMITED', 'Retry in 9 seconds'],
      [503, 'JIRA_UNAVAILABLE', 'Jira is unavailable'],
    ])('leaves the key untracked and explains %i %s', async (status, code, message) => {
      stubFetch({ [ADD]: () => failure(status, code, { 'Retry-After': '9' }) });
      const tracking = useTracking();

      await expect(tracking.track('MASIN-1')).resolves.toBe(false);

      expect(tracking.isTracked('MASIN-1')).toBe(false);
      expect(tracking.isPending('MASIN-1')).toBe(false);
      expect(tracking.errorFor('MASIN-1')).toContain(message);
    });

    it('explains a network failure and clears the error on the next success', async () => {
      let attempt = 0;
      stubFetch({
        [ADD]: () => {
          if (++attempt === 1) throw new TypeError('Failed to fetch');
          return jsonResponse(201, entry('e1', 'MASIN-1'));
        },
      });
      const tracking = useTracking();

      await tracking.track('MASIN-1');
      expect(tracking.errorFor('MASIN-1')).toContain('Cannot reach the server');

      await tracking.track('MASIN-1');
      expect(tracking.errorFor('MASIN-1')).toBeNull();
      expect(tracking.isTracked('MASIN-1')).toBe(true);
    });
  });

  describe('untrack', () => {
    it('deletes by entry id and drops the key only after the server confirms', async () => {
      let release: (response: Response) => void = () => undefined;
      const calls = stubFetch({
        [LIST]: () => listOf(['e1', 'MASIN-1']),
        [remove('e1')]: () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      });
      const tracking = useTracking();
      await tracking.ensureLoaded();

      const pending = tracking.untrack('MASIN-1');
      expect(tracking.isPending('MASIN-1')).toBe(true);
      expect(tracking.isTracked('MASIN-1')).toBe(true);

      release(new Response(null, { status: 204 }));
      await expect(pending).resolves.toBe(true);

      expect(calls.map((c) => `${c.method} ${c.url}`)).toContain(remove('e1'));
      expect(tracking.isTracked('MASIN-1')).toBe(false);
    });

    it('keeps the key tracked and explains the failure when the delete fails', async () => {
      stubFetch({
        [LIST]: () => listOf(['e1', 'MASIN-1']),
        [remove('e1')]: () => failure(503, 'JIRA_UNAVAILABLE'),
      });
      const tracking = useTracking();
      await tracking.ensureLoaded();

      await expect(tracking.untrack('MASIN-1')).resolves.toBe(false);

      expect(tracking.isTracked('MASIN-1')).toBe(true);
      expect(tracking.errorFor('MASIN-1')).toContain('Jira is unavailable');
    });

    it('does nothing for a key it does not know', async () => {
      const calls = stubFetch({});
      const tracking = useTracking();

      await expect(tracking.untrack('MASIN-1')).resolves.toBe(false);

      expect(calls).toHaveLength(0);
    });
  });
});
