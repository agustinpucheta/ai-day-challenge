import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FETCHED_AT, errorItem, errorResponse, listBody } from '@/test/fixtures';
import { jsonResponse, stubFetch } from '@/test/http';
import { resetTracking } from '@/tracking/useTracking';
import TrackToggle from './TrackToggle.vue';

const LIST = 'GET /api/v1/users/me/tracked-issues';
const ADD = 'POST /api/v1/users/me/tracked-issues';
const del = (id: string) => `DELETE /api/v1/users/me/tracked-issues/${id}`;
const entry = { id: 'e1', issueKey: 'MASIN-1', addedAt: FETCHED_AT };

async function mountToggle(routes: Parameters<typeof stubFetch>[0], key = 'MASIN-1') {
  const calls = stubFetch(routes);
  const wrapper = mount(TrackToggle, { props: { issueKey: key } });
  await flushPromises();
  return { wrapper, calls };
}

const label = (wrapper: ReturnType<typeof mount>) => wrapper.get('button').text();

describe('TrackToggle', () => {
  beforeEach(() => resetTracking());
  afterEach(() => vi.unstubAllGlobals());

  it('is disabled while it does not yet know whether the issue is followed', async () => {
    const { wrapper } = await mountToggle({ [LIST]: () => new Promise<Response>(() => undefined) });

    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true');
  });

  it('offers Track, named with the key, for an issue that is not followed', async () => {
    const { wrapper } = await mountToggle({ [LIST]: () => jsonResponse(200, listBody([])) });

    expect(label(wrapper)).toBe('Track MASIN-1');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
  });

  it('offers Untrack for an issue that is already followed, even if its Jira read failed', async () => {
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([errorItem('MASIN-1')])),
    });

    expect(label(wrapper)).toBe('Untrack MASIN-1');
  });

  it('tracks: busy while pending, tracked only after the server confirms', async () => {
    let release: (response: Response) => void = () => undefined;
    const { wrapper, calls } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([])),
      [ADD]: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });

    await wrapper.get('button').trigger('click');

    expect(label(wrapper)).toBe('Siguiendo… MASIN-1');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    release(jsonResponse(201, entry));
    await flushPromises();

    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ issueKey: 'MASIN-1' });
    expect(label(wrapper)).toBe('Untrack MASIN-1');
  });

  it('treats an already followed issue (200) as tracked', async () => {
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([])),
      [ADD]: () => jsonResponse(200, entry),
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(label(wrapper)).toBe('Untrack MASIN-1');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows the limit message and stays untracked when the limit is reached', async () => {
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([])),
      [ADD]: () => errorResponse(409, 'TRACKING_LIMIT_REACHED'),
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Podés seguir hasta 50 issues');
    expect(label(wrapper)).toBe('Track MASIN-1');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
  });

  it.each([
    [404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE', 'Issue no encontrado o sin acceso'],
    [409, 'JIRA_NOT_CONNECTED', 'Jira no está configurado'],
    [424, 'JIRA_REAUTH_REQUIRED', 'Jira rechazó el token de API'],
    [503, 'JIRA_UNAVAILABLE', 'Jira no está disponible'],
  ])('explains %i %s and leaves the issue untracked', async (status, code, text) => {
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([])),
      [ADD]: () => errorResponse(status, code),
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain(text);
    expect(label(wrapper)).toBe('Track MASIN-1');
  });

  it('still lets the user track when the followed keys could not be loaded', async () => {
    const { wrapper } = await mountToggle({
      [LIST]: () => errorResponse(503, 'JIRA_UNAVAILABLE'),
      [ADD]: () => jsonResponse(201, entry),
    });

    expect(label(wrapper)).toBe('Track MASIN-1');
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined();
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(label(wrapper)).toBe('Untrack MASIN-1');
  });

  it('untracks: stays tracked while pending and until the server confirms', async () => {
    let release: (response: Response) => void = () => undefined;
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([errorItem('MASIN-1')])),
      [del('id-MASIN-1')]: () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    });

    await wrapper.get('button').trigger('click');

    expect(label(wrapper)).toBe('Quitando… MASIN-1');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
    release(new Response(null, { status: 204 }));
    await flushPromises();

    expect(label(wrapper)).toBe('Track MASIN-1');
  });

  it('keeps the issue tracked and explains when untracking fails', async () => {
    const { wrapper } = await mountToggle({
      [LIST]: () => jsonResponse(200, listBody([errorItem('MASIN-1')])),
      [del('id-MASIN-1')]: () => errorResponse(503, 'JIRA_UNAVAILABLE'),
    });

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(label(wrapper)).toBe('Untrack MASIN-1');
    expect(wrapper.get('[role="alert"]').text()).toContain('Jira no está disponible');
  });
});
