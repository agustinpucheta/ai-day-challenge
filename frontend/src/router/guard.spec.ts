import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import type { CurrentUser } from '@/api/client';
import { ApiError } from '@/api/errors';
import { createAuthGuard } from './guard';

const Stub = { render: () => null };
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: Stub, meta: { requiresAuth: true } },
  { path: '/settings', name: 'settings', component: Stub, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: Stub, meta: { guestOnly: true } },
  { path: '/unavailable', name: 'unavailable', component: Stub },
];

const user: CurrentUser = {
  userId: 'u1',
  email: 'ana@example.com',
  displayName: 'Ana',
  jira: { connected: false },
};

async function navigate(loadSession: () => Promise<CurrentUser | null>, path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.beforeEach(createAuthGuard(loadSession));
  await router.push(path);
  return router.currentRoute.value;
}

describe('auth route guard', () => {
  it('redirects an anonymous user to login, keeping the target as redirect', async () => {
    const route = await navigate(async () => null, '/settings');

    expect(route.name).toBe('login');
    expect(route.query.redirect).toBe('/settings');
  });

  it('lets an authenticated user through', async () => {
    const loadSession = vi.fn(async () => user);

    const route = await navigate(loadSession, '/settings');

    expect(route.name).toBe('settings');
    expect(loadSession).toHaveBeenCalled();
  });

  it('sends an authenticated user away from login to the sanitized redirect', async () => {
    const route = await navigate(async () => user, '/login?redirect=https://evil.example.com');

    expect(route.path).toBe('/');
  });

  it('shows the unavailable page when the session cannot be checked', async () => {
    const route = await navigate(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con el servidor.');
    }, '/settings');

    expect(route.name).toBe('unavailable');
    expect(route.query.redirect).toBe('/settings');
  });
});
