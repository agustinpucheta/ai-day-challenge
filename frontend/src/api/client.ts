import { es } from '@/i18n/es';
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
export type IssueSummary = Schemas['IssueSummaryDto'];
export type IssueStatus = Schemas['IssueStatusDto'];
export type IssueSearchResult = Schemas['IssueSearchResponseDto'];
export type DashboardIssue = Schemas['DashboardIssueResponseDto'];
export type Progress = Schemas['ProgressDto'];
export type DashboardChild = Schemas['DashboardChildDto'];
export type TrackedIssueEntry = Schemas['TrackedIssueEntryDto'];
export type TrackedIssueItem = Schemas['TrackedIssueItemDto'];
export type TrackedIssuesResponse = Schemas['TrackedIssuesResponseDto'];

export interface IssueSearchParams {
  q: string;
  pageToken?: string;
  pageSize?: number;
}

/** Optional per-call settings; `signal` cancels the underlying fetch. */
export interface CallOptions {
  signal?: AbortSignal;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
/** Only paths that exist in the generated OpenAPI contract compile. */
type ApiPath = keyof paths;

export interface ApiClientOptions {
  fetch?: typeof fetch;
  /** Called when a protected call returns 401 (expired or revoked session). */
  onUnauthenticated?: () => void;
}

interface RequestOptions {
  body?: unknown;
  /** Values for `{placeholders}` in the path; each one is URL-encoded. */
  params?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
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

function buildUrl(
  path: string,
  params: Record<string, string> = {},
  query: Record<string, string | number | undefined> = {},
): string {
  const resolved = path.replace(/\{(\w+)\}/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? ''),
  );
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${resolved}?${qs}` : resolved;
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
    { body, params, query, signal, notifyUnauthenticated = true }: RequestOptions = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(buildUrl(path, params, query), {
        method,
        signal,
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, ClientErrorCode.NETWORK_ERROR, es.client.network);
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
        es.client.unexpectedHttp(response.status),
      );
    }
    if (payload === undefined) {
      throw new ApiError(
        response.status,
        ClientErrorCode.UNEXPECTED_RESPONSE,
        es.client.unexpected,
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
    /** Read-only search by text or key. Failures throw; an empty `items` only means no matches. */
    searchIssues: ({ q, pageToken, pageSize }: IssueSearchParams, { signal }: CallOptions = {}) =>
      request<IssueSearchResult>('GET', '/api/v1/jira/issues/search', {
        query: { q, pageToken, pageSize },
        signal,
      }),
    getDashboardIssue: (issueKey: string, { signal }: CallOptions = {}) =>
      request<DashboardIssue>('GET', '/api/v1/dashboard/issues/{issueKey}', {
        params: { issueKey },
        signal,
      }),
    /** Follows an issue. 201 (new) and 200 (already followed) both resolve with the entry. */
    addTrackedIssue: (issueKey: string, { signal }: CallOptions = {}) =>
      request<TrackedIssueEntry>('POST', '/api/v1/users/me/tracked-issues', {
        body: { issueKey },
        signal,
      }),
    /** Followed issues with progress. A failing item is `status: 'error'`, never a failed call. */
    listTrackedIssues: (
      { refresh = false }: { refresh?: boolean } = {},
      { signal }: CallOptions = {},
    ) =>
      request<TrackedIssuesResponse>('GET', '/api/v1/users/me/tracked-issues', {
        query: { refresh: refresh ? 'true' : undefined },
        signal,
      }),
    /** Idempotent: resolves (204) whether or not the entry still exists. */
    removeTrackedIssue: (id: string, { signal }: CallOptions = {}) =>
      request<void>('DELETE', '/api/v1/users/me/tracked-issues/{id}', {
        params: { id },
        signal,
      }),
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
