import { ApiError, ClientErrorCode, type ValidationDetail } from './errors';
import type { components, paths } from './schema';

type Schemas = components['schemas'];

export type CurrentUser = Schemas['MeResponseDto'];
export type LoginRequest = Schemas['LoginDto'];
export type RegisterRequest = Schemas['RegisterDto'];
export type Preferences = Schemas['PreferencesResponseDto'];
export type PreferencesUpdate = Schemas['UpdatePreferencesDto'];
export type JiraConnectionStatus = Schemas['JiraConnectionStatusDto'];
export type JiraConnectionVerification = Schemas['JiraConnectionVerifyDto'];

type HttpMethod = 'GET' | 'POST' | 'PATCH';
/** Only paths that exist in the generated OpenAPI contract compile. */
type ApiPath = keyof paths;

export interface ApiClientOptions {
  fetch?: typeof fetch;
  /** Called when a protected call returns 401 (expired or revoked session). */
  onUnauthenticated?: () => void;
}

interface RequestOptions {
  body?: unknown;
  /** False for calls where 401 is an expected answer (session probe, login). */
  notifyUnauthenticated?: boolean;
}

function isErrorBody(
  value: unknown,
): value is { code: string; message: string; details?: ValidationDetail[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/** `Retry-After` in whole seconds; HTTP-date values are ignored (Jira sends seconds). */
function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After');
  if (raw === null || !/^\d+$/.test(raw.trim())) {
    return undefined;
  }
  return Number(raw.trim());
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Thin typed wrapper over fetch. Auth is the HttpOnly session cookie (`credentials: 'include'`);
 * no token is ever read or stored by the browser code.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  // Resolve fetch lazily so tests (and polyfills) can replace the global at any time.
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function request<T>(
    method: HttpMethod,
    path: ApiPath,
    { body, notifyUnauthenticated = true }: RequestOptions = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(path, {
        method,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        0,
        ClientErrorCode.NETWORK_ERROR,
        'Cannot reach the server. Check your connection and try again.',
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }
    const payload = await readJson(response);

    if (!response.ok) {
      if (response.status === 401 && notifyUnauthenticated) {
        options.onUnauthenticated?.();
      }
      if (isErrorBody(payload)) {
        throw new ApiError(
          response.status,
          payload.code,
          payload.message,
          payload.details,
          parseRetryAfter(response),
        );
      }
      throw new ApiError(
        response.status,
        ClientErrorCode.UNEXPECTED_RESPONSE,
        `The server returned an unexpected response (HTTP ${response.status}).`,
      );
    }
    if (payload === undefined) {
      throw new ApiError(
        response.status,
        ClientErrorCode.UNEXPECTED_RESPONSE,
        'The server returned an unexpected response.',
      );
    }
    return payload as T;
  }

  return {
    me: () => request<CurrentUser>('GET', '/api/v1/auth/me', { notifyUnauthenticated: false }),
    login: (body: LoginRequest) =>
      request<CurrentUser>('POST', '/api/v1/auth/login', { body, notifyUnauthenticated: false }),
    register: (body: RegisterRequest) =>
      request<CurrentUser>('POST', '/api/v1/auth/register', { body }),
    logout: () => request<void>('POST', '/api/v1/auth/logout'),
    getPreferences: () => request<Preferences>('GET', '/api/v1/users/me/preferences'),
    updatePreferences: (body: PreferencesUpdate) =>
      request<Preferences>('PATCH', '/api/v1/users/me/preferences', { body }),
    /** Local state only; never calls Jira. */
    getJiraConnection: () => request<JiraConnectionStatus>('GET', '/api/v1/jira/connection'),
    /** Read-only probe of the Jira credentials. Jira failures are 4xx/5xx but never 401. */
    verifyJiraConnection: () =>
      request<JiraConnectionVerification>('POST', '/api/v1/jira/connection/verify'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

let unauthenticatedHandler: () => void = () => undefined;

/** Registers the app-wide reaction to an expired session (set once in main.ts). */
export function setUnauthenticatedHandler(handler: () => void): void {
  unauthenticatedHandler = handler;
}

export const api: ApiClient = createApiClient({
  onUnauthenticated: () => unauthenticatedHandler(),
});
