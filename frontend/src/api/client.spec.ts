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
});
