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
});
