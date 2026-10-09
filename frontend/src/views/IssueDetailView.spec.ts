import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/http';
import { createTestRouter } from '@/test/router';
import IssueDetailView from './IssueDetailView.vue';

const SECRET = 'ATATT-secret-token-value';
const EMAIL = 'owner@example.com';

const status = { name: 'In Progress', categoryKey: 'indeterminate', isCancelled: false };

function detail(
  overrides: {
    issue?: Record<string, unknown>;
    subtasks?: unknown[];
    warnings?: string[];
  } = {},
) {
  return jsonResponse(200, {
    issue: {
      id: '10001',
      key: 'MASIN-1',
      summary: 'Fix login',
      issueType: { id: '1', name: 'Story', hierarchyLevel: 0, isSubtask: false },
      status,
      url: 'https://acme.atlassian.net/browse/MASIN-1',
      parentKey: null,
      storyPoints: { final: 3, planned: 3 },
      accountEmail: EMAIL,
      token: SECRET,
      ...overrides.issue,
    },
    subtasks: overrides.subtasks ?? [],
    metadata: {
      fetchedAt: '2026-10-09T12:00:00.000Z',
      isStale: false,
      warnings: overrides.warnings ?? [],
    },
  });
}

const failure = (statusCode: number, code: string) =>
  new Response(JSON.stringify({ code, message: `server says ${code}` }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });

/** Stubs fetch for `/dashboard/issues/:key`; returns the keys that were requested. */
function stubDetail(handler: (key: string) => Response | Promise<Response>): string[] {
  const requested: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const key = decodeURIComponent(String(input).split('/').pop() ?? '');
      requested.push(key);
      return handler(key);
    }),
  );
  return requested;
}

async function mountAt(path: string) {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(IssueDetailView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

type Wrapper = Awaited<ReturnType<typeof mountAt>>['wrapper'];

const sp = (wrapper: Wrapper, which: 'final' | 'planned') =>
  wrapper.get(`[data-testid="sp-${which}"]`).text();

const refreshButton = (wrapper: Wrapper) =>
  wrapper.findAll('button').find((b) => b.text().startsWith('Refresh'));

describe('IssueDetailView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the header with status, type and the Jira link', async () => {
    stubDetail(() => detail());

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(wrapper.get('h1').text()).toContain('MASIN-1');
    expect(wrapper.get('h1').text()).toContain('Fix login');
    expect(wrapper.text()).toContain('Story');
    expect(wrapper.find('.badge--indeterminate').text()).toBe('In Progress');
    const link = wrapper.get('a[target="_blank"]');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.attributes('href')).toBe('https://acme.atlassian.net/browse/MASIN-1');
    expect(wrapper.text()).toContain('Last fetched');
    expect(wrapper.html()).not.toContain(SECRET);
    expect(wrapper.html()).not.toContain(EMAIL);
  });

  it('shows "Not estimated" for null story points, never 0', async () => {
    stubDetail(() => detail({ issue: { storyPoints: { final: null, planned: null } } }));

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(sp(wrapper, 'final')).toContain('Not estimated');
    expect(sp(wrapper, 'planned')).toContain('Not estimated');
    expect(sp(wrapper, 'final')).not.toMatch(/\b0\b/);
    expect(wrapper.text()).not.toContain('vs planned');
  });

  it('shows a deviation hint only when both are numbers and differ', async () => {
    stubDetail(() => detail({ issue: { storyPoints: { final: 5, planned: 3 } } }));
    const differing = await mountAt('/issues/MASIN-1');
    expect(sp(differing.wrapper, 'final')).toContain('5');
    expect(sp(differing.wrapper, 'planned')).toContain('3');
    expect(differing.wrapper.text()).toContain('+2 vs planned');

    stubDetail(() => detail({ issue: { storyPoints: { final: 3, planned: 3 } } }));
    const same = await mountAt('/issues/MASIN-1');
    expect(same.wrapper.text()).not.toContain('vs planned');

    stubDetail(() => detail({ issue: { storyPoints: { final: 3, planned: null } } }));
    const half = await mountAt('/issues/MASIN-1');
    expect(half.wrapper.text()).not.toContain('vs planned');
    expect(sp(half.wrapper, 'planned')).toContain('Not estimated');
  });

  it('shows an explicit empty state for no subtasks', async () => {
    stubDetail(() => detail({ subtasks: [] }));

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(wrapper.text()).toContain('No subtasks');
    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('%');
  });

  it('lists subtasks with badge and Jira link, and links the parent', async () => {
    stubDetail(() =>
      detail({
        issue: { parentKey: 'MASIN-100' },
        subtasks: [
          {
            key: 'MASIN-2',
            summary: 'Write tests',
            status: { name: 'Done', categoryKey: 'done', isCancelled: false },
            url: 'https://acme.atlassian.net/browse/MASIN-2',
          },
        ],
      }),
    );

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody a').attributes('href')).toBe('/issues/MASIN-2');
    expect(wrapper.find('tbody .badge--done').text()).toBe('Done');
    expect(wrapper.get('tbody a[target="_blank"]').attributes('href')).toContain('MASIN-2');
    expect(wrapper.get('a[href="/issues/MASIN-100"]').text()).toBe('MASIN-100');
  });

  it('renders metadata warnings', async () => {
    stubDetail(() => detail({ warnings: ['Subtasks were truncated'] }));

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(wrapper.get('.warnings').text()).toContain('Subtasks were truncated');
  });

  it('shows one message for not found / no access, without retry', async () => {
    stubDetail(() => failure(404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE'));

    const { wrapper } = await mountAt('/issues/NOPE-1');

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Issue not found or you don't have access",
    );
    expect(wrapper.text()).not.toContain('Try again');
    expect(wrapper.text()).not.toContain('Not estimated');
    expect(wrapper.text()).not.toContain('No subtasks');
  });

  it.each([
    [400, 'VALIDATION_ERROR', 'server says VALIDATION_ERROR'],
    [409, 'JIRA_NOT_CONNECTED', 'Jira is not connected'],
    [424, 'JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
    [424, 'JIRA_FORBIDDEN', 'Jira denied access'],
    [429, 'JIRA_RATE_LIMITED', 'Jira is rate limiting requests'],
    [503, 'JIRA_UNAVAILABLE', 'Jira is unavailable'],
  ])('shows %i %s as an error with no zero values', async (statusCode, code, text) => {
    stubDetail(() => failure(statusCode, code));

    const { wrapper } = await mountAt('/issues/MASIN-1');

    expect(wrapper.get('[role="alert"]').text()).toContain(text);
    expect(wrapper.text()).not.toContain('No subtasks');
    expect(wrapper.text()).not.toContain('Final (consumed)');
  });

  it('shows a network error and retries', async () => {
    let attempt = 0;
    stubDetail(() => {
      if (++attempt === 1) throw new TypeError('Failed to fetch');
      return detail();
    });
    const { wrapper } = await mountAt('/issues/MASIN-1');
    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server');

    await wrapper.get('[role="alert"] + div button').trigger('click');
    await flushPromises();

    expect(wrapper.get('h1').text()).toContain('Fix login');
  });

  it('refresh re-fetches the issue and is busy while it runs', async () => {
    let release: (response: Response) => void = () => undefined;
    let call = 0;
    const requested = stubDetail(() =>
      ++call === 1
        ? detail()
        : new Promise<Response>((resolve) => {
            release = resolve;
          }),
    );
    const { wrapper } = await mountAt('/issues/MASIN-1');

    await refreshButton(wrapper)?.trigger('click');
    expect(wrapper.get('[aria-labelledby="issue-title"]').attributes('aria-busy')).toBe('true');
    release(detail({ issue: { summary: 'Fix login (updated)' } }));
    await flushPromises();

    expect(requested).toEqual(['MASIN-1', 'MASIN-1']);
    expect(wrapper.get('h1').text()).toContain('updated');
  });

  it('shows an error, not the old numbers, when a refresh fails', async () => {
    let call = 0;
    stubDetail(() => (++call === 1 ? detail() : failure(503, 'JIRA_UNAVAILABLE')));
    const { wrapper } = await mountAt('/issues/MASIN-1');

    await refreshButton(wrapper)?.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Jira is unavailable');
    expect(wrapper.text()).not.toContain('Final (consumed)');
  });

  it('ignores the previous issue when the route key changes mid-flight', async () => {
    let releaseOld: (response: Response) => void = () => undefined;
    stubDetail((key) =>
      key === 'MASIN-1'
        ? new Promise<Response>((resolve) => {
            releaseOld = resolve;
          })
        : detail({ issue: { key: 'MASIN-2', summary: 'Second issue' } }),
    );
    const { wrapper, router } = await mountAt('/issues/MASIN-1');

    await router.push('/issues/MASIN-2');
    await flushPromises();
    releaseOld(detail({ issue: { summary: 'Old issue' } }));
    await flushPromises();

    expect(wrapper.get('h1').text()).toContain('Second issue');
    expect(wrapper.text()).not.toContain('Old issue');
  });
});
