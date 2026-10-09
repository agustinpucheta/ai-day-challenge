import { onScopeDispose, readonly, ref } from 'vue';
import { api, type IssueSummary } from '@/api/client';
import { normalizeQuery } from './query';

/** Every variant is distinct: an error is never an empty list and loading is never "no results". */
export type IssueSearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | {
      kind: 'loaded';
      query: string;
      items: IssueSummary[];
      nextPageToken: string | null;
      fetchedAt: string;
      loadingMore: boolean;
      loadMoreError: unknown;
    };

function appendUnique(current: IssueSummary[], incoming: IssueSummary[]): IssueSummary[] {
  const seen = new Set(current.map((item) => item.key));
  const fresh = incoming.filter((item) => !seen.has(item.key) && seen.add(item.key));
  return [...current, ...fresh];
}

/**
 * Paginated issue search. Only the latest request may change the state: a response (or error)
 * that belongs to an older query or page request is ignored, and its fetch is aborted.
 */
export function useIssueSearch() {
  const state = ref<IssueSearchState>({ kind: 'idle' });
  let generation = 0;
  let controller: AbortController | null = null;

  function begin() {
    controller?.abort();
    controller = new AbortController();
    return { id: ++generation, signal: controller.signal };
  }

  async function search(rawQuery: string): Promise<void> {
    const query = normalizeQuery(rawQuery);
    const { id, signal } = begin();
    state.value = { kind: 'loading' };
    try {
      const result = await api.searchIssues({ q: query }, { signal });
      if (id !== generation) return;
      state.value = {
        kind: 'loaded',
        query,
        items: appendUnique([], result.items),
        nextPageToken: result.nextPageToken,
        fetchedAt: result.metadata.fetchedAt,
        loadingMore: false,
        loadMoreError: null,
      };
    } catch (error) {
      if (id !== generation) return;
      state.value = { kind: 'error', error };
    }
  }

  async function loadMore(): Promise<void> {
    const current = state.value;
    if (current.kind !== 'loaded' || current.nextPageToken === null || current.loadingMore) return;
    const { id, signal } = begin();
    state.value = { ...current, loadingMore: true, loadMoreError: null };
    try {
      const result = await api.searchIssues(
        { q: current.query, pageToken: current.nextPageToken },
        { signal },
      );
      if (id !== generation) return;
      state.value = {
        ...current,
        items: appendUnique(current.items, result.items),
        nextPageToken: result.nextPageToken,
        fetchedAt: result.metadata.fetchedAt,
        loadingMore: false,
        loadMoreError: null,
      };
    } catch (error) {
      if (id !== generation) return;
      state.value = { ...current, loadingMore: false, loadMoreError: error };
    }
  }

  /** Back to the initial state, cancelling anything in flight. */
  function reset(): void {
    begin();
    state.value = { kind: 'idle' };
  }

  onScopeDispose(() => controller?.abort());

  return { state: readonly(state), search, loadMore, reset };
}
