import { readonly, ref, shallowReactive } from 'vue';
import { api } from '@/api/client';
import { actionErrorMessage } from './errorCopy';

export type TrackingLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface KnownEntry {
  id: string;
  issueKey: string;
}

/**
 * Session-wide knowledge of which issue keys the user follows (issueKey -> tracking entry id).
 * It lives at module level so the search results, the issue detail and the dashboard agree.
 * Nothing is optimistic: a key becomes (un)tracked only after the server confirmed it.
 */
const loadState = ref<TrackingLoadState>('idle');
const ids = shallowReactive(new Map<string, string>());
const pending = shallowReactive(new Set<string>());
const errors = shallowReactive(new Map<string, string>());

/** Keys changed by the user while a list request was in flight; the list must not undo them. */
const activeSyncs = new Set<Set<string>>();
let loading: Promise<void> | null = null;
/** Bumped by `resetTracking` so a response from before the reset cannot repopulate the state. */
let epoch = 0;

function markTouched(key: string): void {
  for (const touched of activeSyncs) touched.add(key);
}

/** Test helper: forgets everything, as a fresh page load would. */
export function resetTracking(): void {
  loadState.value = 'idle';
  ids.clear();
  pending.clear();
  errors.clear();
  activeSyncs.clear();
  loading = null;
  epoch += 1;
}

/**
 * Starts tracking one list request. `apply` makes the list authoritative, except for keys the user
 * changed meanwhile; `cancel` abandons it (failed or superseded request).
 */
function beginSync() {
  const touched = new Set<string>();
  const startedAt = epoch;
  activeSyncs.add(touched);
  return {
    apply(items: readonly KnownEntry[]): void {
      activeSyncs.delete(touched);
      if (startedAt !== epoch) return;
      const next = new Map<string, string>();
      for (const item of items) {
        if (!touched.has(item.issueKey)) next.set(item.issueKey, item.id);
      }
      for (const key of touched) {
        const id = ids.get(key);
        if (id !== undefined) next.set(key, id);
      }
      ids.clear();
      for (const [key, id] of next) ids.set(key, id);
      loadState.value = 'ready';
    },
    cancel(): void {
      activeSyncs.delete(touched);
    },
  };
}

/** Loads the followed keys once per page load; a failed load is retried by the next call. */
function ensureLoaded(): Promise<void> {
  if (loadState.value === 'ready') return Promise.resolve();
  if (loading) return loading;
  loadState.value = 'loading';
  const sync = beginSync();
  loading = api
    .listTrackedIssues()
    .then((result) => sync.apply(result.items))
    .catch(() => {
      sync.cancel();
      loadState.value = 'error';
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

async function track(issueKey: string): Promise<boolean> {
  if (pending.has(issueKey)) return false;
  pending.add(issueKey);
  errors.delete(issueKey);
  try {
    const entry = await api.addTrackedIssue(issueKey);
    ids.set(entry.issueKey, entry.id);
    markTouched(entry.issueKey);
    return true;
  } catch (error) {
    errors.set(issueKey, actionErrorMessage(error));
    return false;
  } finally {
    pending.delete(issueKey);
  }
}

async function untrack(issueKey: string): Promise<boolean> {
  const id = ids.get(issueKey);
  if (id === undefined || pending.has(issueKey)) return false;
  pending.add(issueKey);
  errors.delete(issueKey);
  try {
    await api.removeTrackedIssue(id);
    ids.delete(issueKey);
    markTouched(issueKey);
    return true;
  } catch (error) {
    errors.set(issueKey, actionErrorMessage(error));
    return false;
  } finally {
    pending.delete(issueKey);
  }
}

export function useTracking() {
  return {
    loadState: readonly(loadState),
    ensureLoaded,
    beginSync,
    track,
    untrack,
    isTracked: (issueKey: string): boolean => ids.has(issueKey),
    isPending: (issueKey: string): boolean => pending.has(issueKey),
    errorFor: (issueKey: string): string | null => errors.get(issueKey) ?? null,
    clearError: (issueKey: string): void => {
      errors.delete(issueKey);
    },
  };
}
