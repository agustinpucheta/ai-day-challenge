import { computed, onScopeDispose, ref, shallowReactive } from 'vue';
import { api, type DashboardChild, type DashboardIssue, type TrackedIssueItem } from '@/api/client';
import { isApiError } from '@/api/errors';
import { useTracking } from './useTracking';

/** A per-item error; `retryAfterSeconds` is only known after a retry on that card. */
export interface TrackedItemError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
}

export type TrackedItem = Omit<TrackedIssueItem, 'error'> & { error?: TrackedItemError };

export type ChildrenState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'loaded'; children: DashboardChild[] };

/** Every variant is distinct: a failed list is never an empty one and loading is never "none". */
export type TrackedListState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'loaded'; items: TrackedItem[]; fetchedAt: string; refreshing: boolean };

/** Rebuilds a list item from the issue detail, which carries the same data for one issue. */
function itemFromDetail(current: TrackedItem, detail: DashboardIssue): TrackedItem {
  const { issue } = detail;
  return {
    id: current.id,
    issueKey: current.issueKey,
    addedAt: current.addedAt,
    status: 'ok',
    issue: {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      url: issue.url,
      storyPoints: issue.storyPoints,
    },
    progress: detail.progress,
    ...(detail.children ? { childrenCount: detail.children.length } : {}),
    warnings: detail.metadata.warnings,
    fetchedAt: detail.metadata.fetchedAt,
  };
}

/**
 * The "My tracking" list. Only the latest list request may change the state (older responses are
 * ignored and aborted). Refresh drops the expanded-epic cache, so children are always re-read after
 * it. Per-item retry re-reads one issue through the detail endpoint, which also reports Retry-After.
 */
export function useTrackedList() {
  const tracking = useTracking();
  const state = ref<TrackedListState>({ kind: 'loading' });
  const expanded = shallowReactive(new Set<string>());
  const children = shallowReactive(new Map<string, ChildrenState>());
  const retrying = shallowReactive(new Set<string>());

  let generation = 0;
  let controller: AbortController | null = null;

  function resetExpansion(): void {
    expanded.clear();
    children.clear();
    retrying.clear();
  }

  async function load(refresh: boolean, keepCurrent: boolean): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const id = ++generation;
    const current = state.value;
    resetExpansion();
    state.value =
      keepCurrent && current.kind === 'loaded'
        ? { ...current, refreshing: true }
        : { kind: 'loading' };
    const sync = tracking.beginSync();
    try {
      const result = await api.listTrackedIssues({ refresh }, { signal });
      if (id !== generation) {
        sync.cancel();
        return;
      }
      sync.apply(result.items);
      state.value = {
        kind: 'loaded',
        items: result.items,
        fetchedAt: result.metadata.fetchedAt,
        refreshing: false,
      };
    } catch (error) {
      sync.cancel();
      if (id !== generation) return;
      // A failed refresh never leaves the old numbers on screen as if they were current.
      state.value = { kind: 'error', error };
    }
  }

  function patchItem(key: string, change: (item: TrackedItem) => TrackedItem): void {
    const current = state.value;
    if (current.kind !== 'loaded') return;
    state.value = {
      ...current,
      items: current.items.map((item) => (item.issueKey === key ? change(item) : item)),
    };
  }

  async function loadChildren(key: string): Promise<void> {
    if (children.get(key)?.kind === 'loading') return;
    const id = generation;
    children.set(key, { kind: 'loading' });
    try {
      const detail = await api.getDashboardIssue(key, { signal: controller?.signal });
      if (id !== generation) return;
      children.set(key, { kind: 'loaded', children: detail.children ?? [] });
    } catch (error) {
      if (id !== generation) return;
      children.set(key, { kind: 'error', error });
    }
  }

  /** Expands or collapses an epic; its stories are fetched on first expand and then cached. */
  function toggle(key: string): void {
    if (expanded.has(key)) {
      expanded.delete(key);
      return;
    }
    expanded.add(key);
    const cached = children.get(key);
    if (cached === undefined || cached.kind === 'error') void loadChildren(key);
  }

  async function retryItem(key: string): Promise<void> {
    if (retrying.has(key)) return;
    const id = generation;
    retrying.add(key);
    try {
      const detail = await api.getDashboardIssue(key, { signal: controller?.signal });
      if (id !== generation) return;
      patchItem(key, (item) => itemFromDetail(item, detail));
      children.delete(key);
      expanded.delete(key);
    } catch (error) {
      if (id !== generation) return;
      const failure: TrackedItemError = isApiError(error)
        ? { code: error.code, message: error.message, retryAfterSeconds: error.retryAfterSeconds }
        : { code: 'UNKNOWN', message: 'Something went wrong.' };
      patchItem(key, (item) => ({ ...item, error: failure }));
    } finally {
      if (id === generation) retrying.delete(key);
    }
  }

  /** Stops tracking; the card disappears only after the server confirmed the removal. */
  async function remove(key: string): Promise<boolean> {
    if (!(await tracking.untrack(key))) return false;
    const current = state.value;
    if (current.kind === 'loaded') {
      state.value = { ...current, items: current.items.filter((item) => item.issueKey !== key) };
    }
    expanded.delete(key);
    children.delete(key);
    return true;
  }

  onScopeDispose(() => controller?.abort());
  void load(false, false);

  return {
    /** Read-only view: the list changes only through the actions below. */
    state: computed(() => state.value),
    expanded,
    children,
    retrying,
    refresh: () => load(true, true),
    retry: () => load(false, false),
    toggle,
    retryChildren: loadChildren,
    retryItem,
    remove,
  };
}
