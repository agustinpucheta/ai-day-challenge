import { onMounted, readonly, ref } from 'vue';
import { api } from '@/api/client';
import { isApiError } from '@/api/errors';

export type JiraErrorReason =
  'reauth_required' | 'forbidden' | 'rate_limited' | 'unavailable' | 'network' | 'unknown';

/** What the panel shows. Every variant is distinct; there is no "empty means fine" state. */
export type JiraConnectionState =
  | { kind: 'loading' }
  | { kind: 'not_configured' }
  | { kind: 'configured'; siteUrl: string | null }
  | { kind: 'verifying'; siteUrl: string | null }
  | { kind: 'connected'; siteUrl: string; displayName: string; checkedAt: string }
  | {
      kind: 'error';
      reason: JiraErrorReason;
      /** Whether retrying re-reads the local status (status call failed) or re-verifies. */
      retry: 'reload' | 'verify';
      siteUrl: string | null;
      retryAfterSeconds?: number;
    };

function reasonOf(error: unknown): JiraErrorReason {
  if (!isApiError(error)) return 'unknown';
  switch (error.code) {
    case 'JIRA_REAUTH_REQUIRED':
      return 'reauth_required';
    case 'JIRA_FORBIDDEN':
      return 'forbidden';
    case 'JIRA_RATE_LIMITED':
      return 'rate_limited';
    case 'JIRA_UNAVAILABLE':
      return 'unavailable';
    case 'NETWORK_ERROR':
      return 'network';
    default:
      return 'unknown';
  }
}

/**
 * Loads the local Jira connection status on mount and, when credentials are configured, verifies
 * them once automatically. Later verifications are manual (`verify`).
 */
export function useJiraConnection() {
  const state = ref<JiraConnectionState>({ kind: 'loading' });
  let busy = false;

  async function verify(siteUrl: string | null): Promise<void> {
    state.value = { kind: 'verifying', siteUrl };
    try {
      const result = await api.verifyJiraConnection();
      state.value = {
        kind: 'connected',
        siteUrl: result.siteUrl,
        displayName: result.displayName,
        checkedAt: result.checkedAt,
      };
    } catch (error) {
      if (isApiError(error, 'JIRA_NOT_CONNECTED')) {
        state.value = { kind: 'not_configured' };
        return;
      }
      state.value = {
        kind: 'error',
        reason: reasonOf(error),
        retry: 'verify',
        siteUrl,
        retryAfterSeconds: isApiError(error) ? error.retryAfterSeconds : undefined,
      };
    }
  }

  /** Re-reads the local status; verifies automatically when credentials are configured. */
  async function load(): Promise<void> {
    if (busy) return;
    busy = true;
    state.value = { kind: 'loading' };
    try {
      const status = await api.getJiraConnection();
      if (status.status === 'not_configured') {
        state.value = { kind: 'not_configured' };
        return;
      }
      await verify(status.siteUrl);
    } catch (error) {
      state.value = { kind: 'error', reason: reasonOf(error), retry: 'reload', siteUrl: null };
    } finally {
      busy = false;
    }
  }

  /** Manual verification from the current site; ignored while another call is in flight. */
  async function verifyAgain(): Promise<void> {
    if (busy) return;
    const current = state.value;
    const siteUrl = 'siteUrl' in current ? current.siteUrl : null;
    busy = true;
    try {
      await verify(siteUrl);
    } finally {
      busy = false;
    }
  }

  onMounted(() => void load());

  return { state: readonly(state), reload: load, verify: verifyAgain };
}
