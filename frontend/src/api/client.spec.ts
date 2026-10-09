import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/http';
import { createApiClient } from './client';
import { ApiError } from './errors';

describe('api client', () => {
  it('maps a 401 error body to ApiError UNAUTHENTICATED', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }),
    );
    const api = createApiClient({ fetch: fetchMock });

    const error = await api.me().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
  });

  it('reports a network failure distinctly from an HTTP error', async () => {
    const api = createApiClient({
      fetch: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });

    const error = await api.me().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('does not leak a non-JSON error body', async () => {
    const api = createApiClient({
      fetch: vi.fn(
        async () => new Response('<html>Bad gateway stack trace</html>', { status: 502 }),
      ),
    });

    const error = await api.me().catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
    expect((error as ApiError).message).not.toContain('stack trace');
  });

  it('keeps validation details from a VALIDATION_ERROR body', async () => {
    const api = createApiClient({
      fetch: vi.fn(async () =>
        jsonResponse(400, {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: [{ field: 'timezone', constraints: ['timezone must be an IANA time zone'] }],
        }),
      ),
    });

    const error = await api.updatePreferences({ timezone: 'Mars/Base' }).catch((e: unknown) => e);

    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: [{ field: 'timezone', constraints: ['timezone must be an IANA time zone'] }],
    });
  });

  it('sends cookies and JSON to the versioned API path', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, {
        userId: 'u1',
        email: 'ana@example.com',
        displayName: null,
        jira: { connected: false },
      }),
    );
    const api = createApiClient({ fetch: fetchMock });

    const user = await api.login({ email: 'ana@example.com', password: 'a-strong-password' });

    expect(user.email).toBe('ana@example.com');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/login');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(init!.body as string)).toEqual({
      email: 'ana@example.com',
      password: 'a-strong-password',
    });
  });

  it('resolves 204 responses without a body', async () => {
    const api = createApiClient({ fetch: vi.fn(async () => new Response(null, { status: 204 })) });

    await expect(api.logout()).resolves.toBeUndefined();
  });

  it('notifies the unauthenticated handler for protected calls only', async () => {
    const onUnauthenticated = vi.fn();
    const api = createApiClient({
      fetch: vi.fn(async () =>
        jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }),
      ),
      onUnauthenticated,
    });

    await api.getPreferences().catch(() => undefined);
    await api.me().catch(() => undefined);

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  describe('Jira connection', () => {
    it('reads the connection status and verifies it with the typed endpoints', async () => {
      const fetchMock = vi.fn<typeof fetch>(async (input) =>
        String(input).endsWith('/verify')
          ? jsonResponse(200, {
              status: 'connected',
              siteUrl: 'https://acme.atlassian.net',
              displayName: 'Ada Lovelace',
              checkedAt: '2026-10-09T12:00:00.000Z',
            })
          : jsonResponse(200, {
              mode: 'api_token',
              status: 'configured',
              siteUrl: 'https://acme.atlassian.net',
            }),
      );
      const api = createApiClient({ fetch: fetchMock });

      await expect(api.getJiraConnection()).resolves.toMatchObject({ status: 'configured' });
      await expect(api.verifyJiraConnection()).resolves.toMatchObject({
        displayName: 'Ada Lovelace',
      });
      expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`)).toEqual([
        'GET /api/v1/jira/connection',
        'POST /api/v1/jira/connection/verify',
      ]);
    });

    it.each([
      [409, 'JIRA_NOT_CONNECTED'],
      [424, 'JIRA_REAUTH_REQUIRED'],
      [424, 'JIRA_FORBIDDEN'],
      [429, 'JIRA_RATE_LIMITED'],
      [503, 'JIRA_UNAVAILABLE'],
    ] as const)('maps %i %s to a typed ApiError', async (status, code) => {
      const api = createApiClient({
        fetch: vi.fn(async () => jsonResponse(status, { code, message: `message for ${code}` })),
      });

      const error = await api.verifyJiraConnection().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, code, message: `message for ${code}` });
    });

    it('exposes Retry-After seconds and ignores invalid values', async () => {
      const respond = (retryAfter: string): Promise<ApiError> =>
        createApiClient({
          fetch: vi.fn(
            async () =>
              new Response(JSON.stringify({ code: 'JIRA_RATE_LIMITED', message: 'Slow down' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
              }),
          ),
        })
          .verifyJiraConnection()
          .then(
            () => {
              throw new Error('expected a failure');
            },
            (e: unknown) => e as ApiError,
          );

      expect((await respond('30')).retryAfterSeconds).toBe(30);
      expect((await respond('Wed, 21 Oct 2026 07:28:00 GMT')).retryAfterSeconds).toBeUndefined();
    });

    it('does not treat a Jira 424 as an expired session, unlike a real 401', async () => {
      const onUnauthenticated = vi.fn();
      const jira424 = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(424, { code: 'JIRA_REAUTH_REQUIRED', message: 'Jira rejected the token' }),
        ),
        onUnauthenticated,
      });
      const session401 = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }),
        ),
        onUnauthenticated,
      });

      await jira424.verifyJiraConnection().catch(() => undefined);
      expect(onUnauthenticated).not.toHaveBeenCalled();

      await session401.verifyJiraConnection().catch(() => undefined);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });

  describe('issues', () => {
    const summary = {
      key: 'MASIN-1',
      summary: 'Login',
      issueType: { id: '1', name: 'Story', hierarchyLevel: 0, isSubtask: false },
      status: { name: 'To Do', categoryKey: 'new', isCancelled: false },
      url: 'https://acme.atlassian.net/browse/MASIN-1',
    };

    it('searches with an encoded query and optional page params', async () => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        jsonResponse(200, {
          items: [summary],
          nextPageToken: null,
          metadata: { fetchedAt: '2026-10-09T12:00:00.000Z', isStale: false },
        }),
      );
      const api = createApiClient({ fetch: fetchMock });

      const result = await api.searchIssues({ q: 'a&b c', pageToken: 'tok_1-2', pageSize: 5 });

      expect(result.items).toHaveLength(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        '/api/v1/jira/issues/search?q=a%26b+c&pageToken=tok_1-2&pageSize=5',
      );
    });

    it('omits undefined query params and encodes the issue key in the path', async () => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        jsonResponse(200, { issue: {}, subtasks: [], metadata: {} }),
      );
      const api = createApiClient({ fetch: fetchMock });

      await api.searchIssues({ q: 'login' }).catch(() => undefined);
      await api.getDashboardIssue('MASIN-1/../x');

      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/jira/issues/search?q=login');
      expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/dashboard/issues/MASIN-1%2F..%2Fx');
    });

    it.each([
      [400, 'VALIDATION_ERROR'],
      [404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE'],
      [409, 'JIRA_NOT_CONNECTED'],
      [424, 'JIRA_REAUTH_REQUIRED'],
      [424, 'JIRA_FORBIDDEN'],
      [503, 'JIRA_UNAVAILABLE'],
    ])('maps %i %s to a typed ApiError for both calls', async (status, code) => {
      const api = createApiClient({
        fetch: vi.fn(async () => jsonResponse(status, { code, message: `m ${code}` })),
      });

      for (const call of [
        () => api.searchIssues({ q: 'login' }),
        () => api.getDashboardIssue('MASIN-1'),
      ]) {
        const error = await call().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status, code });
      }
    });

    it('keeps Retry-After on a 429 and reports network failures', async () => {
      const limited = createApiClient({
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify({ code: 'JIRA_RATE_LIMITED', message: 'slow down' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': '42' },
            }),
        ),
      });
      const offline = createApiClient({
        fetch: vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      });

      expect(await limited.searchIssues({ q: 'login' }).catch((e: unknown) => e)).toMatchObject({
        code: 'JIRA_RATE_LIMITED',
        retryAfterSeconds: 42,
      });
      expect(await offline.getDashboardIssue('MASIN-1').catch((e: unknown) => e)).toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
      });
    });

    it('never triggers the session-expiry handler for Jira failures, only for a real 401', async () => {
      const onUnauthenticated = vi.fn();
      const jira = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(424, { code: 'JIRA_REAUTH_REQUIRED', message: 'token rejected' }),
        ),
        onUnauthenticated,
      });
      const session = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }),
        ),
        onUnauthenticated,
      });

      await jira.searchIssues({ q: 'login' }).catch(() => undefined);
      await jira.getDashboardIssue('MASIN-1').catch(() => undefined);
      expect(onUnauthenticated).not.toHaveBeenCalled();

      await session.getDashboardIssue('MASIN-1').catch(() => undefined);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });

  describe('tracked issues', () => {
    const entry = { id: 'e1', issueKey: 'MASIN-1', addedAt: '2026-10-09T12:00:00.000Z' };
    const calls = (fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) =>
      fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`);

    it('adds with the key in a JSON body; 201 and 200 both resolve with the entry', async () => {
      for (const status of [201, 200]) {
        const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(status, entry));
        const api = createApiClient({ fetch: fetchMock });

        await expect(api.addTrackedIssue('MASIN-1')).resolves.toEqual(entry);

        expect(calls(fetchMock)).toEqual(['POST /api/v1/users/me/tracked-issues']);
        expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
          issueKey: 'MASIN-1',
        });
      }
    });

    it('lists with and without refresh=true', async () => {
      const body = { items: [], metadata: { fetchedAt: '2026-10-09T12:00:00.000Z' } };
      const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(200, body));
      const api = createApiClient({ fetch: fetchMock });

      await api.listTrackedIssues();
      await api.listTrackedIssues({ refresh: false });
      await api.listTrackedIssues({ refresh: true });

      expect(calls(fetchMock)).toEqual([
        'GET /api/v1/users/me/tracked-issues',
        'GET /api/v1/users/me/tracked-issues',
        'GET /api/v1/users/me/tracked-issues?refresh=true',
      ]);
    });

    it('removes by encoded entry id and resolves on 204', async () => {
      const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
      const api = createApiClient({ fetch: fetchMock });

      await expect(api.removeTrackedIssue('a/b')).resolves.toBeUndefined();

      expect(calls(fetchMock)).toEqual(['DELETE /api/v1/users/me/tracked-issues/a%2Fb']);
    });

    it.each([
      [404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE'],
      [409, 'TRACKING_LIMIT_REACHED'],
      [409, 'JIRA_NOT_CONNECTED'],
      [424, 'JIRA_REAUTH_REQUIRED'],
      [424, 'JIRA_FORBIDDEN'],
      [429, 'JIRA_RATE_LIMITED'],
      [503, 'JIRA_UNAVAILABLE'],
    ])('maps %i %s to a typed ApiError for every tracking call', async (status, code) => {
      const api = createApiClient({
        fetch: vi.fn(async () => jsonResponse(status, { code, message: `m ${code}` })),
      });

      for (const call of [
        () => api.addTrackedIssue('MASIN-1'),
        () => api.listTrackedIssues(),
        () => api.removeTrackedIssue('e1'),
      ]) {
        const error = await call().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status, code });
      }
    });

    it('keeps Retry-After on a 429 and reports network failures', async () => {
      const limited = createApiClient({
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify({ code: 'JIRA_RATE_LIMITED', message: 'slow down' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': '12' },
            }),
        ),
      });
      const offline = createApiClient({
        fetch: vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      });

      expect(await limited.addTrackedIssue('MASIN-1').catch((e: unknown) => e)).toMatchObject({
        code: 'JIRA_RATE_LIMITED',
        retryAfterSeconds: 12,
      });
      expect(await offline.listTrackedIssues().catch((e: unknown) => e)).toMatchObject({
        status: 0,
        code: 'NETWORK_ERROR',
      });
    });

    it('treats Jira 424 as a Jira failure, never an expired session; a real 401 still is', async () => {
      const onUnauthenticated = vi.fn();
      const jira = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(424, { code: 'JIRA_REAUTH_REQUIRED', message: 'token rejected' }),
        ),
        onUnauthenticated,
      });
      const session = createApiClient({
        fetch: vi.fn(async () =>
          jsonResponse(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }),
        ),
        onUnauthenticated,
      });

      await jira.addTrackedIssue('MASIN-1').catch(() => undefined);
      await jira.listTrackedIssues().catch(() => undefined);
      await jira.removeTrackedIssue('e1').catch(() => undefined);
      expect(onUnauthenticated).not.toHaveBeenCalled();

      await session.listTrackedIssues().catch(() => undefined);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });
});
