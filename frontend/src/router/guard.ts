import type { NavigationGuard } from 'vue-router';
import type { CurrentUser } from '@/api/client';
import { sanitizeRedirect } from './redirect';

declare module 'vue-router' {
  interface RouteMeta {
    /** Only reachable with a valid session. */
    requiresAuth?: boolean;
    /** Login/register: a signed-in user is sent to the app instead. */
    guestOnly?: boolean;
  }
}

/**
 * `loadSession` resolves the current user, `null` when there is no session (401), and throws
 * when the session cannot be checked at all (network/server failure).
 */
export function createAuthGuard(loadSession: () => Promise<CurrentUser | null>): NavigationGuard {
  return async (to) => {
    if (to.meta.requiresAuth) {
      try {
        const user = await loadSession();
        return user ? true : { name: 'login', query: { redirect: to.fullPath } };
      } catch {
        return { name: 'unavailable', query: { redirect: to.fullPath } };
      }
    }
    if (to.meta.guestOnly) {
      try {
        const user = await loadSession();
        return user ? sanitizeRedirect(to.query.redirect) : true;
      } catch {
        // The login form itself will surface the failure if the server stays unreachable.
        return true;
      }
    }
    return true;
  };
}
