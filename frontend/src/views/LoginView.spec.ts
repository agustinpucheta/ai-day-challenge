import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { resetSession, useSession } from '@/auth/session';
import { jsonResponse, stubFetch } from '@/test/http';
import LoginView from './LoginView.vue';

const Stub = { render: () => null };

async function mountLogin(path = '/login') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Stub },
      { path: '/settings', name: 'settings', component: Stub },
      { path: '/login', name: 'login', component: LoginView },
      { path: '/register', name: 'register', component: Stub },
    ],
  });
  await router.push(path);
  const wrapper = mount(LoginView, { global: { plugins: [router] } });
  return { wrapper, router };
}

async function submit(wrapper: Awaited<ReturnType<typeof mountLogin>>['wrapper']) {
  await wrapper.get('input[type="email"]').setValue('ana@example.com');
  await wrapper.get('input[type="password"]').setValue('a-strong-password');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('LoginView', () => {
  beforeEach(() => resetSession());

  it('submits the credentials and shows the backend error message', async () => {
    const calls = stubFetch({
      'POST /api/v1/auth/login': () =>
        jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
    });
    const { wrapper, router } = await mountLogin();

    await submit(wrapper);

    expect(calls[0]?.body).toEqual({ email: 'ana@example.com', password: 'a-strong-password' });
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'El correo o la contraseña no son correctos',
    );
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('stores the user and goes to the sanitized redirect on success', async () => {
    stubFetch({
      'POST /api/v1/auth/login': () =>
        jsonResponse(200, {
          userId: 'u1',
          email: 'ana@example.com',
          displayName: 'Ana',
          jira: { connected: false },
        }),
    });
    const { wrapper, router } = await mountLogin('/login?redirect=/settings');

    await submit(wrapper);

    expect(router.currentRoute.value.path).toBe('/settings');
    expect(useSession().user.value?.email).toBe('ana@example.com');
  });
});
