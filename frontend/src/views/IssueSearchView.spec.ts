import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/http';
import { createTestRouter } from '@/test/router';
import IssueSearchView from './IssueSearchView.vue';

const SECRET = 'ATATT-secret-token-value';
const FETCHED_AT = '2026-10-09T12:00:00.000Z';

const issue = (key: string, overrides: Record<string, unknown> = {}) => ({
  key,
  summary: `Summary of ${key}`,
  issueType: { id: '10001', name: 'Story', hierarchyLevel: 0, isSubtask: false },
  status: { name: 'In Progress', categoryKey: 'indeterminate', isCancelled: false },
  url: `https://acme.atlassian.net/browse/${key}`,
  leakedToken: SECRET,
  ...overrides,
});

const page = (items: unknown[], nextPageToken: string | null = null) =>
  jsonResponse(200, { items, nextPageToken, metadata: { fetchedAt: FETCHED_AT, isStale: false } });

const failure = (status: number, code: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ code, message: `server says ${code}` }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

/** Stubs fetch; `handler` receives the parsed request URL. Returns every requested URL. */
function stubSearch(handler: (url: URL) => Response | Promise<Response>): URL[] {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      urls.push(url);
      return handler(url);
    }),
  );
  return urls;
}

async function mountAt(path: string) {
  const router = createTestRouter();
  await router.push(path);
  await router.isReady();
  const wrapper = mount(IssueSearchView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

type Wrapper = Awaited<ReturnType<typeof mountAt>>['wrapper'];

async function submit(wrapper: Wrapper, text: string) {
  await wrapper.get('input[type="search"]').setValue(text);
  await wrapper.get('form[role="search"]').trigger('submit');
  await flushPromises();
}

const loadMoreButton = (wrapper: Wrapper) =>
  wrapper.findAll('button').find((b) => b.text() === 'Load more');

describe('IssueSearchView', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for a query and calls nothing when the URL has none', async () => {
    const urls = stubSearch(() => page([]));

    const { wrapper } = await mountAt('/issues');

    expect(wrapper.text()).toContain('Search by text or by issue key');
    expect(urls).toHaveLength(0);
  });

  it('rejects queries shorter than 2 characters without calling the backend', async () => {
    const urls = stubSearch(() => page([]));
    const { wrapper } = await mountAt('/issues');

    await submit(wrapper, ' a ');

    expect(wrapper.get('.field__error').text()).toContain('at least 2');
    expect(urls).toHaveLength(0);
  });

  it('does not search a too-short query that comes from the URL', async () => {
    const urls = stubSearch(() => page([]));

    const { wrapper } = await mountAt('/issues?q=a');

    expect(wrapper.get('[role="alert"]').text()).toContain('at least 2');
    expect(urls).toHaveLength(0);
  });

  it('lists results with links, badges, count and fetch time; keeps the query in the URL', async () => {
    const urls = stubSearch(() =>
      page([
        issue('MASIN-1'),
        issue('MASIN-2', { status: { name: 'Closed', categoryKey: 'done', isCancelled: true } }),
      ]),
    );
    const { wrapper, router } = await mountAt('/issues');

    await submit(wrapper, '  login  ');

    expect(router.currentRoute.value.query.q).toBe('login');
    expect(urls[0]?.searchParams.get('q')).toBe('login');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.get('tbody a').attributes('href')).toBe('/issues/MASIN-1');
    const external = wrapper.get('a[target="_blank"]');
    expect(external.attributes('rel')).toBe('noopener noreferrer');
    expect(external.attributes('href')).toBe('https://acme.atlassian.net/browse/MASIN-1');
    expect(wrapper.find('.badge--indeterminate').text()).toBe('In Progress');
    expect(wrapper.find('.badge--cancelled').text()).toBe('Cancelled');
    expect(wrapper.text()).toContain('2 loaded');
    expect(wrapper.text()).toContain('Last fetched');
    expect(wrapper.html()).not.toContain(SECRET);
  });

  it('searches on load when the URL already has a query', async () => {
    const urls = stubSearch(() => page([issue('MASIN-9')]));

    const { wrapper } = await mountAt('/issues?q=MASIN-9');

    expect(urls).toHaveLength(1);
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('MASIN-9');
    expect(wrapper.text()).toContain('MASIN-9');
  });

  it('shows "No issues found" only for a successful empty 200', async () => {
    stubSearch(() => page([]));

    const { wrapper } = await mountAt('/issues?q=nothing');

    expect(wrapper.text()).toContain('No issues found for “nothing”');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it.each([
    [400, 'VALIDATION_ERROR', 'server says VALIDATION_ERROR'],
    [409, 'JIRA_NOT_CONNECTED', 'Jira is not connected'],
    [424, 'JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
    [424, 'JIRA_FORBIDDEN', 'Jira denied access'],
    [429, 'JIRA_RATE_LIMITED', 'Retry in 17 seconds'],
    [503, 'JIRA_UNAVAILABLE', 'Jira is unavailable'],
  ])('shows %i %s as an error, never as an empty list', async (status, code, text) => {
    stubSearch(() => failure(status, code, { 'Retry-After': '17' }));

    const { wrapper } = await mountAt('/issues?q=login');

    expect(wrapper.get('[role="alert"]').text()).toContain(text);
    expect(wrapper.text()).not.toContain('No issues found');
    expect(wrapper.text()).not.toContain('loaded');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('links to the connection panel when Jira is not connected', async () => {
    stubSearch(() => failure(409, 'JIRA_NOT_CONNECTED'));

    const { wrapper } = await mountAt('/issues?q=login');

    expect(wrapper.get('[role="alert"] a').attributes('href')).toBe('/');
    expect(wrapper.text()).toContain('JIRA_API_TOKEN');
  });

  it('shows a network error and recovers through Try again', async () => {
    let attempt = 0;
    stubSearch(() => {
      if (++attempt === 1) throw new TypeError('Failed to fetch');
      return page([issue('MASIN-1')]);
    });
    const { wrapper } = await mountAt('/issues?q=login');
    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server');
    expect(wrapper.text()).not.toContain('No issues found');

    await wrapper.get('[role="alert"] + div button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('MASIN-1');
  });

  it('appends the next page and drops duplicate keys', async () => {
    const urls = stubSearch((url) =>
      url.searchParams.get('pageToken') === 'next-1'
        ? page([issue('MASIN-2'), issue('MASIN-3')], null)
        : page([issue('MASIN-1'), issue('MASIN-2')], 'next-1'),
    );
    const { wrapper } = await mountAt('/issues?q=login');
    expect(wrapper.text()).toContain('2 loaded');

    await loadMoreButton(wrapper)?.trigger('click');
    await flushPromises();

    expect(urls[1]?.searchParams.get('pageToken')).toBe('next-1');
    expect(urls[1]?.searchParams.get('q')).toBe('login');
    expect(wrapper.findAll('tbody tr').map((row) => row.get('a').text())).toEqual([
      'MASIN-1',
      'MASIN-2',
      'MASIN-3',
    ]);
    expect(wrapper.text()).toContain('3 loaded');
    expect(loadMoreButton(wrapper)).toBeUndefined();
  });

  it('keeps loaded rows and shows the error when loading more fails', async () => {
    stubSearch((url) =>
      url.searchParams.has('pageToken')
        ? failure(503, 'JIRA_UNAVAILABLE')
        : page([issue('MASIN-1')], 'next-1'),
    );
    const { wrapper } = await mountAt('/issues?q=login');

    await loadMoreButton(wrapper)?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('MASIN-1');
    expect(wrapper.get('[role="alert"]').text()).toContain('Jira is unavailable');
  });

  it('ignores a stale response when the query changes', async () => {
    let releaseFirst: (response: Response) => void = () => undefined;
    stubSearch((url) =>
      url.searchParams.get('q') === 'first'
        ? new Promise<Response>((resolve) => {
            releaseFirst = resolve;
          })
        : page([issue('MASIN-2')]),
    );
    const { wrapper, router } = await mountAt('/issues?q=first');
    expect(wrapper.text()).toContain('Searching Jira');

    await router.push('/issues?q=second');
    await flushPromises();
    releaseFirst(page([issue('MASIN-OLD')]));
    await flushPromises();

    expect(wrapper.text()).toContain('MASIN-2');
    expect(wrapper.text()).not.toContain('MASIN-OLD');
  });

  it('marks the view busy while searching', async () => {
    stubSearch(() => new Promise<Response>(() => undefined));

    const { wrapper } = await mountAt('/issues?q=login');

    expect(wrapper.get('[aria-labelledby="issues-title"]').attributes('aria-busy')).toBe('true');
  });
});
