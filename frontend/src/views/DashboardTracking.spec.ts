import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_CANCELLED,
  EMAIL,
  NO_SUBTASKS,
  SECRET,
  childBody,
  detailBody,
  epicItem,
  errorItem,
  errorResponse,
  listBody,
  okItem,
  progress,
} from '@/test/fixtures';
import { jsonResponse, stubFetch } from '@/test/http';
import { createTestRouter } from '@/test/router';
import { resetTracking } from '@/tracking/useTracking';
import DashboardView from './DashboardView.vue';

const SITE = 'https://acme.atlassian.net';
const LIST = 'GET /api/v1/users/me/tracked-issues';
const LIST_REFRESH = 'GET /api/v1/users/me/tracked-issues?refresh=true';
const detail = (key: string) => `GET /api/v1/dashboard/issues/${key}`;
const del = (id: string) => `DELETE /api/v1/users/me/tracked-issues/${id}`;

const connection = {
  'GET /api/v1/jira/connection': () =>
    jsonResponse(200, { mode: 'api_token', status: 'configured', siteUrl: SITE }),
  'POST /api/v1/jira/connection/verify': () =>
    jsonResponse(200, {
      status: 'connected',
      siteUrl: SITE,
      displayName: 'Ada Lovelace',
      checkedAt: '2026-10-09T12:00:00.000Z',
    }),
};

type Routes = Parameters<typeof stubFetch>[0];

async function mountDashboard(routes: Routes) {
  const calls = stubFetch({ ...connection, ...routes });
  const router = createTestRouter();
  const wrapper = mount(DashboardView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router, calls };
}

type Wrapper = Awaited<ReturnType<typeof mountDashboard>>['wrapper'];

const cards = (wrapper: Wrapper) => wrapper.findAll('article.tracked-card');
const card = (wrapper: Wrapper, key: string) => {
  const found = cards(wrapper).find((c) => c.get('h2').text() === key);
  if (!found) throw new Error(`No card for ${key}`);
  return found;
};
const button = (root: Pick<Wrapper, 'findAll'>, text: string) =>
  root.findAll('button').find((b) => b.text().startsWith(text));
const click = async (root: Pick<Wrapper, 'findAll'>, text: string) => {
  const target = button(root, text);
  if (!target) throw new Error(`No button "${text}"`);
  await target.trigger('click');
  await flushPromises();
};
const callsTo = (calls: { method: string; url: string }[], route: string) =>
  calls.filter((c) => `${c.method} ${c.url}` === route);

describe('My tracking dashboard', () => {
  beforeEach(() => resetTracking());
  afterEach(() => vi.unstubAllGlobals());

  describe('page states', () => {
    it('shows a busy skeleton while loading, with no numbers', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () => new Promise<Response>(() => undefined),
      });

      expect(wrapper.find('[data-testid="tracking-skeleton"]').exists()).toBe(true);
      expect(wrapper.get('section.page').attributes('aria-busy')).toBe('true');
      expect(wrapper.text()).toContain('Loading tracked issues');
      expect(wrapper.text()).not.toContain('%');
      expect(button(wrapper, 'Refresh')?.attributes('disabled')).toBeDefined();
    });

    it('shows the header, the compact connection line and the search box', async () => {
      const { wrapper } = await mountDashboard({ [LIST]: () => jsonResponse(200, listBody([])) });

      expect(wrapper.get('h1').text()).toBe('My tracking');
      expect(wrapper.text()).toContain('Connected');
      expect(wrapper.text()).toContain('Ada Lovelace');
      expect(wrapper.find('.connection-line').exists()).toBe(true);
      expect(wrapper.find('form[role="search"]').exists()).toBe(true);
    });

    it('shows an explicit empty state with a link to search', async () => {
      const { wrapper } = await mountDashboard({ [LIST]: () => jsonResponse(200, listBody([])) });

      expect(wrapper.text()).toContain("You're not tracking any issues yet");
      expect(wrapper.get('.empty-state a').attributes('href')).toBe('/issues');
      expect(cards(wrapper)).toHaveLength(0);
      expect(wrapper.text()).toContain('Last updated');
    });

    it.each([
      [503, 'JIRA_UNAVAILABLE', 'Jira is unavailable'],
      [409, 'JIRA_NOT_CONNECTED', 'Jira is not connected'],
      [424, 'JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
    ])(
      'shows a failed list request (%i %s) as an error, never as empty',
      async (status, code, text) => {
        const { wrapper } = await mountDashboard({ [LIST]: () => errorResponse(status, code) });

        expect(wrapper.get('[role="alert"]').text()).toContain(text);
        expect(wrapper.text()).not.toContain("You're not tracking any issues yet");
        expect(cards(wrapper)).toHaveLength(0);
      },
    );

    it('recovers from a network error through Try again', async () => {
      let attempt = 0;
      const { wrapper } = await mountDashboard({
        [LIST]: () => {
          if (++attempt === 1) throw new TypeError('Failed to fetch');
          return jsonResponse(200, listBody([okItem('MASIN-1')]));
        },
      });
      expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server');

      await click(wrapper, 'Try again');

      expect(card(wrapper, 'MASIN-1').exists()).toBe(true);
    });
  });

  describe('cards', () => {
    it('renders ok items in the order returned, with a bar that matches the percent', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              okItem('MASIN-2', { progress: progress({ percent: 33.3 }) }),
              okItem('MASIN-1', { progress: progress({ percent: 100, completed: 12 }) }),
            ]),
          ),
      });

      expect(cards(wrapper).map((c) => c.get('h2').text())).toEqual(['MASIN-2', 'MASIN-1']);
      const [first, second] = cards(wrapper);
      expect(first!.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('33.3');
      expect(first!.get('.line-progress__percent').text()).toBe('33.3%');
      expect(second!.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100');
      expect(second!.get('.line-progress__percent').text()).toBe('100%');
      expect(first!.text()).toContain('7 of 12 done · 3 in progress · 2 pending · 1 cancelled');
    });

    it('shows key link, summary, type, status, Jira link and story points', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              okItem('MASIN-1', {
                issue: {
                  ...okItem('MASIN-1').issue,
                  storyPoints: { final: 5, planned: 3 },
                },
              }),
              okItem('MASIN-2'),
            ]),
          ),
      });

      const first = card(wrapper, 'MASIN-1');
      expect(first.get('h2 a').attributes('href')).toBe('/issues/MASIN-1');
      expect(first.text()).toContain('Summary of MASIN-1');
      expect(first.text()).toContain('Story');
      expect(first.get('.badge--indeterminate').text()).toBe('In Progress');
      const external = first.get('a[target="_blank"]');
      expect(external.attributes('href')).toBe('https://acme.atlassian.net/browse/MASIN-1');
      expect(external.attributes('rel')).toBe('noopener noreferrer');
      expect(first.get('[data-testid="sp-planned"]').text()).toContain('3');
      expect(first.get('[data-testid="sp-final"]').text()).toBe('Final 5');
      // null final story points are "Not estimated", never 0
      const second = card(wrapper, 'MASIN-2');
      expect(second.get('[data-testid="sp-final"]').text()).toContain('Not estimated');
      expect(second.get('[data-testid="sp-final"]').text()).not.toMatch(/\b0\b/);
    });

    it('shows a cancelled issue with its own badge', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              okItem('MASIN-1', {
                issue: {
                  ...okItem('MASIN-1').issue,
                  status: { name: 'Closed', categoryKey: 'done', isCancelled: true },
                },
              }),
            ]),
          ),
      });

      expect(wrapper.get('.badge--cancelled').text()).toBe('Cancelled');
      expect(wrapper.find('.badge--done').exists()).toBe(false);
    });

    it('never shows a percentage for "no data" or "all cancelled"', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              okItem('MASIN-1', { progress: NO_SUBTASKS }),
              okItem('MASIN-2', { progress: ALL_CANCELLED }),
              epicItem('MASIN-3', 0, { progress: { ...NO_SUBTASKS, basis: 'children' } }),
            ]),
          ),
      });

      expect(card(wrapper, 'MASIN-1').text()).toContain('No subtasks yet');
      expect(card(wrapper, 'MASIN-2').text()).toContain('All items cancelled');
      expect(card(wrapper, 'MASIN-3').text()).toContain('No children yet');
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('%');
    });

    it('shows the approximate notice and the unknown-status note from the item', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              epicItem('MASIN-1', 300, {
                progress: progress({ basis: 'children', isApproximate: true, unknown: 2 }),
                warnings: ['Only the first 300 children were counted'],
              }),
            ]),
          ),
      });

      const epic = card(wrapper, 'MASIN-1');
      expect(epic.get('.alert--warning').text()).toContain('Approximate');
      expect(epic.get('.alert--warning').text()).toContain('first 300 children');
      expect(epic.text()).toContain('2 items with unknown status');
    });

    it('does not render token or email values that leak into the payload', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1'), errorItem('MASIN-2')])),
      });

      expect(wrapper.html()).not.toContain(SECRET);
      expect(wrapper.html()).not.toContain(EMAIL);
    });
  });

  describe('items that failed in Jira', () => {
    it('renders one error card without progress while the other cards render normally', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              okItem('MASIN-1'),
              errorItem('MASIN-2', 'ISSUE_NOT_FOUND_OR_INACCESSIBLE'),
              okItem('MASIN-3', { progress: progress({ percent: 25 }) }),
            ]),
          ),
      });

      expect(cards(wrapper).map((c) => c.get('h2').text())).toEqual([
        'MASIN-1',
        'MASIN-2',
        'MASIN-3',
      ]);
      const failed = wrapper.get('[data-testid="tracked-error"]');
      expect(failed.text()).toContain('Issue not found or no access');
      expect(failed.find('[role="progressbar"]').exists()).toBe(false);
      expect(failed.text()).not.toContain('%');
      expect(failed.text()).not.toContain(' of ');
      expect(failed.find('.progress').exists()).toBe(false);
      expect(failed.get('.line-progress').attributes('data-state')).toBe('broken');
      expect(failed.find('.line-progress__percent').exists()).toBe(false);
      expect(wrapper.findAll('[role="progressbar"]')).toHaveLength(2);
      // not-found is permanent: no Retry, but it can be removed
      expect(button(failed, 'Retry')).toBeUndefined();
      expect(button(failed, 'Remove')).toBeDefined();
    });

    it.each([
      ['JIRA_NOT_CONNECTED', 'Jira is not configured'],
      ['JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
      ['JIRA_FORBIDDEN', 'Jira denied access'],
      ['JIRA_RATE_LIMITED', 'Jira is rate limiting requests'],
      ['JIRA_UNAVAILABLE', 'Jira is unavailable'],
    ])('explains %s on its own card, with Retry and Remove', async (code, title) => {
      const { wrapper } = await mountDashboard({
        [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1'), errorItem('MASIN-2', code)])),
      });

      const failed = card(wrapper, 'MASIN-2');
      expect(failed.text()).toContain(title);
      expect(button(failed, 'Retry')).toBeDefined();
      expect(button(failed, 'Remove')).toBeDefined();
      expect(card(wrapper, 'MASIN-1').find('[role="progressbar"]').exists()).toBe(true);
    });

    it('says a list-wide failure once and never shows 0% progress', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([
              errorItem('MASIN-1', 'JIRA_NOT_CONNECTED'),
              errorItem('MASIN-2', 'JIRA_NOT_CONNECTED'),
            ]),
          ),
      });

      expect(wrapper.get('[role="alert"]').text()).toContain('Jira is not configured');
      expect(wrapper.get('[role="alert"]').text()).toContain('JIRA_API_TOKEN');
      expect(cards(wrapper)).toHaveLength(2);
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('%');
      // the per-card text is compact: the guidance is not repeated on every card
      expect(wrapper.text().match(/JIRA_API_TOKEN/g)).toHaveLength(1);
    });

    it.each([
      ['JIRA_REAUTH_REQUIRED', 'Jira rejected the API token'],
      ['JIRA_UNAVAILABLE', 'Jira is unavailable'],
    ])('shows %s for every item as one list-level state', async (code, title) => {
      const { wrapper } = await mountDashboard({
        [LIST]: () => jsonResponse(200, listBody([errorItem('MASIN-1', code)])),
      });

      expect(wrapper.get('[role="alert"]').text()).toContain(title);
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    });

    it('retries one card through the issue detail and replaces it with the real data', async () => {
      const { wrapper, calls } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([okItem('MASIN-1'), errorItem('MASIN-2', 'JIRA_UNAVAILABLE')]),
          ),
        [detail('MASIN-2')]: () =>
          jsonResponse(200, detailBody('MASIN-2', { progress: progress({ percent: 40 }) })),
      });

      await click(card(wrapper, 'MASIN-2'), 'Retry');

      expect(callsTo(calls, detail('MASIN-2'))).toHaveLength(1);
      expect(callsTo(calls, LIST)).toHaveLength(1);
      expect(wrapper.find('[data-testid="tracked-error"]').exists()).toBe(false);
      expect(card(wrapper, 'MASIN-2').get('[role="progressbar"]').attributes('aria-valuenow')).toBe(
        '40',
      );
    });

    it('keeps the card as an error, with the retry delay, when the retry is rate limited', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([okItem('MASIN-1'), errorItem('MASIN-2', 'JIRA_UNAVAILABLE')]),
          ),
        [detail('MASIN-2')]: () => errorResponse(429, 'JIRA_RATE_LIMITED', { 'Retry-After': '30' }),
      });

      await click(card(wrapper, 'MASIN-2'), 'Retry');

      const failed = card(wrapper, 'MASIN-2');
      expect(failed.text()).toContain('Jira is rate limiting requests');
      expect(failed.text()).toContain('Retry in 30 seconds');
      expect(failed.find('[role="progressbar"]').exists()).toBe(false);
    });

    it('shows a busy retry button while the card is reloading', async () => {
      let release: (response: Response) => void = () => undefined;
      const { wrapper } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([okItem('MASIN-1'), errorItem('MASIN-2', 'JIRA_UNAVAILABLE')]),
          ),
        [detail('MASIN-2')]: () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      });

      await button(card(wrapper, 'MASIN-2'), 'Retry')?.trigger('click');

      const busy = button(card(wrapper, 'MASIN-2'), 'Retrying');
      expect(busy?.attributes('disabled')).toBeDefined();
      expect(card(wrapper, 'MASIN-2').attributes('aria-busy')).toBe('true');
      release(jsonResponse(200, detailBody('MASIN-2')));
      await flushPromises();
      expect(card(wrapper, 'MASIN-2').find('[role="progressbar"]').exists()).toBe(true);
    });
  });

  describe('refresh', () => {
    it('re-reads with refresh=true and shows the new numbers and time', async () => {
      let release: (response: Response) => void = () => undefined;
      const { wrapper, calls } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(200, listBody([okItem('MASIN-1', { progress: progress({ percent: 10 }) })])),
        [LIST_REFRESH]: () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      });

      await button(wrapper, 'Refresh')?.trigger('click');
      expect(button(wrapper, 'Refreshing')?.attributes('disabled')).toBeDefined();
      expect(wrapper.get('section.page').attributes('aria-busy')).toBe('true');
      release(
        jsonResponse(
          200,
          listBody(
            [okItem('MASIN-1', { progress: progress({ percent: 90 }) })],
            '2026-10-09T13:45:00.000Z',
          ),
        ),
      );
      await flushPromises();

      expect(callsTo(calls, LIST_REFRESH)).toHaveLength(1);
      expect(card(wrapper, 'MASIN-1').get('.line-progress__percent').text()).toBe('90%');
      expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-09T13:45:00.000Z');
    });

    it('shows an error instead of the old numbers when a refresh fails', async () => {
      const { wrapper } = await mountDashboard({
        [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1')])),
        [LIST_REFRESH]: () => errorResponse(503, 'JIRA_UNAVAILABLE'),
      });

      await click(wrapper, 'Refresh');

      expect(wrapper.get('[role="alert"]').text()).toContain('Jira is unavailable');
      expect(cards(wrapper)).toHaveLength(0);
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    });
  });

  describe('epics', () => {
    const epicRoutes = (extra: Routes = {}): Routes => ({
      [LIST]: () => jsonResponse(200, listBody([epicItem('EPIC-1', 2), okItem('MASIN-1')])),
      [detail('EPIC-1')]: () =>
        jsonResponse(
          200,
          detailBody('EPIC-1', {
            children: [
              childBody('MASIN-10', {
                progress: progress({ percent: 50, completed: 1, total: 2 }),
              }),
              childBody('MASIN-11', { progress: NO_SUBTASKS }),
            ],
          }),
        ),
      ...extra,
    });

    it('offers stories only for epics and does not show story points for them', async () => {
      const { wrapper } = await mountDashboard(epicRoutes());

      expect(button(card(wrapper, 'EPIC-1'), 'Show stories (2)')).toBeDefined();
      expect(button(card(wrapper, 'MASIN-1'), 'Show stories')).toBeUndefined();
      expect(card(wrapper, 'EPIC-1').find('[data-testid="sp-planned"]').exists()).toBe(false);
      expect(card(wrapper, 'MASIN-1').find('[data-testid="sp-planned"]').exists()).toBe(true);
    });

    it('loads the stories only on first expand and caches them', async () => {
      const { wrapper, calls } = await mountDashboard(epicRoutes());
      expect(callsTo(calls, detail('EPIC-1'))).toHaveLength(0);

      await click(card(wrapper, 'EPIC-1'), 'Show stories');

      const epic = card(wrapper, 'EPIC-1');
      expect(button(epic, 'Hide stories')?.attributes('aria-expanded')).toBe('true');
      expect(epic.findAll('tbody tr')).toHaveLength(2);
      expect(epic.get('tbody a').attributes('href')).toBe('/issues/MASIN-10');
      expect(epic.text()).toContain('No subtasks yet');
      expect(epic.findAll('[role="progressbar"]')).toHaveLength(2); // epic bar + one child bar

      await click(card(wrapper, 'EPIC-1'), 'Hide stories');
      expect(card(wrapper, 'EPIC-1').find('table').exists()).toBe(false);
      await click(card(wrapper, 'EPIC-1'), 'Show stories');

      expect(card(wrapper, 'EPIC-1').findAll('tbody tr')).toHaveLength(2);
      expect(callsTo(calls, detail('EPIC-1'))).toHaveLength(1);
    });

    it('shows a loading state while the stories load', async () => {
      const { wrapper } = await mountDashboard(
        epicRoutes({ [detail('EPIC-1')]: () => new Promise<Response>(() => undefined) }),
      );

      await button(card(wrapper, 'EPIC-1'), 'Show stories')?.trigger('click');

      expect(card(wrapper, 'EPIC-1').text()).toContain('Loading stories');
      expect(card(wrapper, 'EPIC-1').find('table').exists()).toBe(false);
    });

    it('shows a per-card error and retries loading the stories', async () => {
      let attempt = 0;
      const { wrapper, calls } = await mountDashboard(
        epicRoutes({
          [detail('EPIC-1')]: () =>
            ++attempt === 1
              ? errorResponse(503, 'JIRA_UNAVAILABLE')
              : jsonResponse(200, detailBody('EPIC-1', { children: [childBody('MASIN-10')] })),
        }),
      );

      await click(card(wrapper, 'EPIC-1'), 'Show stories');
      const epic = card(wrapper, 'EPIC-1');
      expect(epic.get('[role="alert"]').text()).toContain('Jira is unavailable');
      // the epic's own progress is untouched by the failed stories request
      expect(epic.get('.line-progress__percent').text()).toBe('58.3%');

      await click(epic, 'Try again');

      expect(callsTo(calls, detail('EPIC-1'))).toHaveLength(2);
      expect(card(wrapper, 'EPIC-1').findAll('tbody tr')).toHaveLength(1);
    });

    it('re-reads the stories after a refresh instead of using the cache', async () => {
      const { wrapper, calls } = await mountDashboard(
        epicRoutes({ [LIST_REFRESH]: () => jsonResponse(200, listBody([epicItem('EPIC-1', 2)])) }),
      );
      await click(card(wrapper, 'EPIC-1'), 'Show stories');

      await click(wrapper, 'Refresh');
      expect(card(wrapper, 'EPIC-1').find('table').exists()).toBe(false);
      await click(card(wrapper, 'EPIC-1'), 'Show stories');

      expect(callsTo(calls, detail('EPIC-1'))).toHaveLength(2);
    });
  });

  describe('stop tracking', () => {
    const routes = (extra: Routes = {}): Routes => ({
      [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1'), okItem('MASIN-2')])),
      ...extra,
    });

    it('asks for confirmation inline and does nothing until confirmed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      const { wrapper, calls } = await mountDashboard(routes());

      await click(card(wrapper, 'MASIN-1'), 'Stop tracking');

      const first = card(wrapper, 'MASIN-1');
      expect(first.get('[role="group"]').text()).toContain('Stop tracking MASIN-1?');
      expect(callsTo(calls, del('id-MASIN-1'))).toHaveLength(0);

      await click(first, 'Cancel');
      expect(card(wrapper, 'MASIN-1').find('[role="group"]').exists()).toBe(false);
      expect(callsTo(calls, del('id-MASIN-1'))).toHaveLength(0);
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('removes the card only after the server confirms', async () => {
      let release: (response: Response) => void = () => undefined;
      const { wrapper, calls } = await mountDashboard(
        routes({
          [del('id-MASIN-1')]: () =>
            new Promise<Response>((resolve) => {
              release = resolve;
            }),
        }),
      );
      await click(card(wrapper, 'MASIN-1'), 'Stop tracking');

      await button(card(wrapper, 'MASIN-1'), 'Yes, remove')?.trigger('click');

      expect(button(card(wrapper, 'MASIN-1'), 'Removing')?.attributes('disabled')).toBeDefined();
      expect(cards(wrapper)).toHaveLength(2);
      release(new Response(null, { status: 204 }));
      await flushPromises();

      expect(callsTo(calls, del('id-MASIN-1'))).toHaveLength(1);
      expect(cards(wrapper).map((c) => c.get('h2').text())).toEqual(['MASIN-2']);
    });

    it('keeps the card and explains the failure when the removal fails', async () => {
      const { wrapper } = await mountDashboard(
        routes({ [del('id-MASIN-1')]: () => errorResponse(503, 'JIRA_UNAVAILABLE') }),
      );
      await click(card(wrapper, 'MASIN-1'), 'Stop tracking');

      await click(card(wrapper, 'MASIN-1'), 'Yes, remove');

      expect(cards(wrapper)).toHaveLength(2);
      expect(card(wrapper, 'MASIN-1').get('[role="alert"]').text()).toContain(
        'Jira is unavailable',
      );
    });

    it('removes an errored item through its own Remove button', async () => {
      const { wrapper, calls } = await mountDashboard({
        [LIST]: () =>
          jsonResponse(
            200,
            listBody([okItem('MASIN-1'), errorItem('MASIN-2', 'ISSUE_NOT_FOUND_OR_INACCESSIBLE')]),
          ),
        [del('id-MASIN-2')]: () => new Response(null, { status: 204 }),
      });

      await click(card(wrapper, 'MASIN-2'), 'Remove');
      await click(card(wrapper, 'MASIN-2'), 'Yes, remove');

      expect(callsTo(calls, del('id-MASIN-2'))).toHaveLength(1);
      expect(cards(wrapper).map((c) => c.get('h2').text())).toEqual(['MASIN-1']);
    });

    it('gives accessible names that include the issue key', async () => {
      const { wrapper } = await mountDashboard(routes());

      const stop = button(card(wrapper, 'MASIN-2'), 'Stop tracking');

      expect(stop?.text()).toContain('MASIN-2');
    });
  });
});
