/** Minimal outbound HTTP port so the Atlassian client can be tested without the network. */
export interface HttpResult {
  status: number;
  /** Header names are lower-cased. */
  headers: Record<string, string>;
  /** Parsed JSON, or `undefined` when the body was empty or not JSON. */
  body: unknown;
}

export interface HttpPort {
  /** Rejects on network failure or timeout. A non-2xx status is a normal result. */
  postJson(url: string, body: unknown): Promise<HttpResult>;
  getJson(url: string, headers: Record<string, string>): Promise<HttpResult>;
}

export const HTTP_PORT = Symbol('HTTP_PORT');

export const HTTP_TIMEOUT_MS = 10_000;

/** Default adapter over global fetch: fixed timeout, no retries, no logging. */
export class FetchHttpPort implements HttpPort {
  constructor(private readonly timeoutMs: number = HTTP_TIMEOUT_MS) {}

  postJson(url: string, body: unknown): Promise<HttpResult> {
    return this.send(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
  }

  getJson(url: string, headers: Record<string, string>): Promise<HttpResult> {
    return this.send(url, { method: 'GET', headers: { accept: 'application/json', ...headers } });
  }

  private async send(url: string, init: RequestInit): Promise<HttpResult> {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text === '' ? undefined : (JSON.parse(text) as unknown);
    } catch {
      body = undefined;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return { status: response.status, headers, body };
  }
}
