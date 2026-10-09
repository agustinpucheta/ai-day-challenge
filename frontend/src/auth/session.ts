import { readonly, ref } from 'vue';
import { api, type CurrentUser, type LoginRequest, type RegisterRequest } from '@/api/client';
import { isApiError } from '@/api/errors';

/**
 * Minimal app-wide session store. It only caches the `/auth/me` answer; the session itself is
 * the HttpOnly cookie managed by the backend.
 */
const user = ref<CurrentUser | null>(null);
let loaded = false;
let inflight: Promise<CurrentUser | null> | null = null;

/** Current user, `null` when anonymous (401). Throws for network/server failures (not cached). */
function loadSession(force = false): Promise<CurrentUser | null> {
  if (loaded && !force) {
    return Promise.resolve(user.value);
  }
  inflight ??= api
    .me()
    .then(
      (me) => {
        user.value = me;
        loaded = true;
        return me;
      },
      (error: unknown) => {
        if (isApiError(error, 'UNAUTHENTICATED')) {
          user.value = null;
          loaded = true;
          return null;
        }
        throw error;
      },
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function login(credentials: LoginRequest): Promise<CurrentUser> {
  const me = await api.login(credentials);
  user.value = me;
  loaded = true;
  return me;
}

/** Registration does not sign the user in (backend contract). */
function register(input: RegisterRequest): Promise<CurrentUser> {
  return api.register(input);
}

async function logout(): Promise<void> {
  await api.logout();
  clearSession();
}

/** Marks the session as known-anonymous (after logout or an expired-session 401). */
function clearSession(): void {
  user.value = null;
  loaded = true;
}

/** Forgets everything, so the next check hits the backend again. Used by tests. */
export function resetSession(): void {
  user.value = null;
  loaded = false;
  inflight = null;
}

export function useSession() {
  return {
    user: readonly(user),
    loadSession,
    login,
    register,
    logout,
    clearSession,
  };
}
