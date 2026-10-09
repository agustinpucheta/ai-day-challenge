import { effectScope, type EffectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  childBody,
  detailBody,
  epicItem,
  errorItem,
  listBody,
  okItem,
  progress,
} from '@/test/fixtures';
import { jsonResponse, stubFetch } from '@/test/http';
import { useTrackedList } from './useTrackedList';
import { resetTracking, useTracking } from './useTracking';

const LIST = 'GET /api/v1/users/me/tracked-issues';
const LIST_REFRESH = 'GET /api/v1/users/me/tracked-issues?refresh=true';
const detail = (key: string) => `GET /api/v1/dashboard/issues/${key}`;

/** Resolves a pending fetch from the outside, to control the order of responses. */
function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let scope: EffectScope;
function run<T>(fn: () => T): T {
  scope = effectScope();
  return scope.run(fn)!;
}

describe('useTrackedList', () => {
  beforeEach(() => resetTracking());
  afterEach(() => {
    scope?.stop();
    vi.unstubAllGlobals();
  });

  it('syncs the followed keys from the list so Track buttons agree with the dashboard', async () => {
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1'), errorItem('MASIN-2')])),
    });

    run(() => useTrackedList());
    await flushPromises();

    expect(useTracking().isTracked('MASIN-1')).toBe(true);
    expect(useTracking().isTracked('MASIN-2')).toBe(true);
  });

  it('ignores the response of a superseded list request', async () => {
    const first = deferred();
    const second = deferred();
    const pending = [first, second];
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1')])),
      [LIST_REFRESH]: () => pending.shift()!.promise,
    });
    const list = run(() => useTrackedList());
    await flushPromises();

    void list.refresh();
    void list.refresh();
    second.resolve(jsonResponse(200, listBody([okItem('MASIN-NEW')])));
    await flushPromises();
    first.resolve(jsonResponse(200, listBody([okItem('MASIN-OLD')])));
    await flushPromises();

    const state = list.state.value;
    expect(state.kind).toBe('loaded');
    expect(state.kind === 'loaded' && state.items.map((i) => i.issueKey)).toEqual(['MASIN-NEW']);
    expect(useTracking().isTracked('MASIN-OLD')).toBe(false);
    expect(useTracking().isTracked('MASIN-NEW')).toBe(true);
  });

  it('ignores a superseded failure so it cannot replace newer data', async () => {
    const first = deferred();
    const second = deferred();
    const pending = [first, second];
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1')])),
      [LIST_REFRESH]: () => pending.shift()!.promise,
    });
    const list = run(() => useTrackedList());
    await flushPromises();

    void list.refresh();
    void list.refresh();
    second.resolve(jsonResponse(200, listBody([okItem('MASIN-NEW')])));
    await flushPromises();
    first.resolve(
      new Response(JSON.stringify({ code: 'JIRA_UNAVAILABLE', message: 'x' }), { status: 503 }),
    );
    await flushPromises();

    expect(list.state.value.kind).toBe('loaded');
  });

  it('ignores the stories of an epic when a refresh happened while they were loading', async () => {
    const stories = deferred();
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([epicItem('EPIC-1', 1)])),
      [LIST_REFRESH]: () => jsonResponse(200, listBody([epicItem('EPIC-1', 1)])),
      [detail('EPIC-1')]: () => stories.promise,
    });
    const list = run(() => useTrackedList());
    await flushPromises();

    list.toggle('EPIC-1');
    await list.refresh();
    stories.resolve(jsonResponse(200, detailBody('EPIC-1', { children: [childBody('MASIN-10')] })));
    await flushPromises();

    expect(list.children.get('EPIC-1')).toBeUndefined();
    expect(list.expanded.has('EPIC-1')).toBe(false);
  });

  it('does not let a late retry overwrite the list after a refresh', async () => {
    const retry = deferred();
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([errorItem('MASIN-1')])),
      [LIST_REFRESH]: () =>
        jsonResponse(200, listBody([okItem('MASIN-1', { progress: progress({ percent: 77 }) })])),
      [detail('MASIN-1')]: () => retry.promise,
    });
    const list = run(() => useTrackedList());
    await flushPromises();

    void list.retryItem('MASIN-1');
    await list.refresh();
    retry.resolve(jsonResponse(200, detailBody('MASIN-1', { progress: progress({ percent: 1 }) })));
    await flushPromises();

    const state = list.state.value;
    expect(state.kind === 'loaded' && state.items[0]?.progress?.percent).toBe(77);
    expect(list.retrying.has('MASIN-1')).toBe(false);
  });

  it('removes an item from the list only after the removal succeeded', async () => {
    const removal = deferred();
    stubFetch({
      [LIST]: () => jsonResponse(200, listBody([okItem('MASIN-1'), okItem('MASIN-2')])),
      'DELETE /api/v1/users/me/tracked-issues/id-MASIN-1': () => removal.promise,
    });
    const list = run(() => useTrackedList());
    await flushPromises();

    const result = list.remove('MASIN-1');
    expect(list.state.value.kind === 'loaded' && list.state.value.items).toHaveLength(2);
    removal.resolve(new Response(null, { status: 204 }));

    await expect(result).resolves.toBe(true);
    const state = list.state.value;
    expect(state.kind === 'loaded' && state.items.map((i) => i.issueKey)).toEqual(['MASIN-2']);
    expect(useTracking().isTracked('MASIN-1')).toBe(false);
  });
});
