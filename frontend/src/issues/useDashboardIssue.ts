import { onScopeDispose, readonly, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { api, type DashboardIssue } from '@/api/client';

export type DashboardIssueState =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'loaded'; data: DashboardIssue; refreshing: boolean };

/**
 * Loads one issue detail and reloads when the key changes. A response for a previous key (or a
 * superseded refresh) is ignored so the view never shows another issue's data.
 */
export function useDashboardIssue(issueKey: MaybeRefOrGetter<string>) {
  const state = ref<DashboardIssueState>({ kind: 'loading' });
  let generation = 0;
  let controller: AbortController | null = null;

  async function fetchIssue(key: string, keepCurrent: boolean): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const id = ++generation;
    const current = state.value;
    state.value =
      keepCurrent && current.kind === 'loaded'
        ? { ...current, refreshing: true }
        : { kind: 'loading' };
    try {
      const data = await api.getDashboardIssue(key, { signal: controller.signal });
      if (id !== generation) return;
      state.value = { kind: 'loaded', data, refreshing: false };
    } catch (error) {
      if (id !== generation) return;
      // A failed refresh never leaves the old numbers on screen as if they were current.
      state.value = { kind: 'error', error };
    }
  }

  watch(
    () => toValue(issueKey),
    (key) => void fetchIssue(key, false),
    { immediate: true },
  );

  onScopeDispose(() => controller?.abort());

  return {
    state: readonly(state),
    refresh: () => fetchIssue(toValue(issueKey), true),
    retry: () => fetchIssue(toValue(issueKey), false),
  };
}
