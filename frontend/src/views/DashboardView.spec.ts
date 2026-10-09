import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, stubFetch } from '@/test/http';
import { createTestRouter } from '@/test/router';
import DashboardView from './DashboardView.vue';

const SECRET = 'ATATT-secret-token-value';
const EMAIL = 'owner@example.com';
const SITE = 'https://acme.atlassian.net';

const configured = () =>
  jsonResponse(200, { mode: 'api_token', status: 'configured', siteUrl: SITE });
const verified = () =>
  jsonResponse(200, {
    status: 'connected',
    siteUrl: SITE,
    displayName: 'Ada Lovelace',
    checkedAt: '2026-10-09T12:00:00.000Z',
  });
const failure = (status: number, code: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ code, message: `server says ${code}` }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const PANEL_BUTTON = '[aria-labelledby="jira-panel-title"] button';

const verifyCalls = (calls: { method: string; url: string }[]) =>
  calls.filter((call) => call.method === 'POST' && call.url.endsWith('/verify'));

async function mountDashboard() {
  const router = createTestRouter();
  const wrapper = mount(DashboardView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('DashboardView Jira connection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the not-configured state and never verifies', async () => {
    const calls = stubFetch({
      'GET /api/v1/jira/connection': () =>
        jsonResponse(200, { mode: 'api_token', status: 'not_configured', siteUrl: null }),
    });

    const { wrapper } = await mountDashboard();

    expect(wrapper.text()).toContain('Not configured');
    expect(wrapper.text()).toContain('JIRA_API_TOKEN');
    expect(verifyCalls(calls)).toHaveLength(0);
  });

  it('verifies once automatically and shows the connected state', async () => {
    const calls = stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': verified,
    });

    const { wrapper } = await mountDashboard();

    expect(wrapper.text()).toContain('Connected');
    expect(wrapper.text()).toContain('Ada Lovelace');
    expect(wrapper.text()).toContain(SITE);
    expect(wrapper.text()).toContain('Last checked');
    expect(verifyCalls(calls)).toHaveLength(1);
    expect(wrapper.html()).not.toContain(SECRET);
    expect(wrapper.html()).not.toContain(EMAIL);
  });

  it('re-verifies only when the user asks', async () => {
    const calls = stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': verified,
    });
    const { wrapper } = await mountDashboard();

    await wrapper.get(PANEL_BUTTON).trigger('click');
    await flushPromises();

    expect(verifyCalls(calls)).toHaveLength(2);
    expect(wrapper.text()).toContain('Connected');
  });

  it('shows the busy verifying state while Jira answers', async () => {
    let release: (response: Response) => void = () => undefined;
    stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });

    const { wrapper } = await mountDashboard();

    expect(wrapper.text()).toContain('Verifying');
    expect(wrapper.get('[aria-labelledby="jira-panel-title"]').attributes('aria-busy')).toBe(
      'true',
    );
    release(verified());
    await flushPromises();
    expect(wrapper.text()).toContain('Connected');
  });

  it.each([
    ['JIRA_REAUTH_REQUIRED', 424, 'Jira rejected the API token'],
    ['JIRA_FORBIDDEN', 424, 'Jira denied access'],
    ['JIRA_RATE_LIMITED', 429, 'Jira is rate limiting requests'],
    ['JIRA_UNAVAILABLE', 503, 'Jira is unavailable'],
  ])('maps %s to its own message, never to success', async (code, status, title) => {
    stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': () => failure(status, code),
    });

    const { wrapper } = await mountDashboard();

    expect(wrapper.get('[role="alert"]').text()).toContain(title);
    expect(wrapper.text()).not.toContain('Connected');
    expect(wrapper.html()).not.toContain(SECRET);
  });

  it('shows Retry-After for rate limiting and recovers through the retry button', async () => {
    let attempt = 0;
    const calls = stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': () =>
        ++attempt === 1 ? failure(429, 'JIRA_RATE_LIMITED', { 'Retry-After': '30' }) : verified(),
    });

    const { wrapper } = await mountDashboard();
    expect(wrapper.text()).toContain('Retry in 30 seconds');

    await wrapper.get(PANEL_BUTTON).trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Connected');
    expect(verifyCalls(calls)).toHaveLength(2);
  });

  it('falls back to not-configured when verify answers JIRA_NOT_CONNECTED', async () => {
    stubFetch({
      'GET /api/v1/jira/connection': configured,
      'POST /api/v1/jira/connection/verify': () => failure(409, 'JIRA_NOT_CONNECTED'),
    });

    const { wrapper } = await mountDashboard();

    expect(wrapper.text()).toContain('Not configured');
  });

  it('shows a network error when the status call fails and reloads on retry', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/verify')) return verified();
        if (++attempt === 1) throw new TypeError('Failed to fetch');
        return configured();
      }),
    );

    const { wrapper } = await mountDashboard();
    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server');

    await wrapper.get(PANEL_BUTTON).trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Connected');
  });

  it('sends a valid search to the issues route and rejects a too-short one', async () => {
    stubFetch({
      'GET /api/v1/jira/connection': () => jsonResponse(200, { status: 'not_configured' }),
    });
    const { wrapper, router } = await mountDashboard();
    const input = wrapper.get('input[type="search"]');

    await input.setValue('a');
    await wrapper.get('form[role="search"]').trigger('submit');
    expect(wrapper.get('.field__error').text()).toContain('at least 2');
    expect(router.currentRoute.value.name).not.toBe('issues');

    await input.setValue('  MASIN-1  ');
    await wrapper.get('form[role="search"]').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('issues');
    expect(router.currentRoute.value.query.q).toBe('MASIN-1');
  });
});
