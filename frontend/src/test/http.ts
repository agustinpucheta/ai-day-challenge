import { vi } from 'vitest';

/** Builds a JSON `Response` like the backend would send. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface RecordedCall {
  url: string;
  method: string;
  body: unknown;
}

type Route = (call: RecordedCall) => Response | Promise<Response>;

/**
 * Replaces the global fetch with a tiny router keyed by "METHOD /path".
 * Returns the recorded calls so tests can assert on what the UI sent.
 */
export function stubFetch(routes: Record<string, Route>): RecordedCall[] {
  const calls: RecordedCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      const call = { url, method, body };
      calls.push(call);
      const route = routes[`${method} ${url}`];
      if (!route) {
        throw new Error(`Unexpected request ${method} ${url}`);
      }
      return route(call);
    }),
  );
  return calls;
}
