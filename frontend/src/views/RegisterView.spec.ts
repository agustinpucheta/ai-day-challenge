import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { jsonResponse, stubFetch } from '@/test/http';
import RegisterView from './RegisterView.vue';

const Stub = { render: () => null };

async function mountRegister() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: Stub },
      { path: '/register', name: 'register', component: RegisterView },
    ],
  });
  await router.push('/register');
  const wrapper = mount(RegisterView, { global: { plugins: [router] } });
  await wrapper.get('#register-email').setValue('ana@example.com');
  await wrapper.get('#register-password').setValue('a-strong-password');
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  return { wrapper, router };
}

describe('RegisterView', () => {
  it('explains that registration is disabled and hides the form', async () => {
    stubFetch({
      'POST /api/v1/auth/register': () =>
        jsonResponse(403, {
          code: 'REGISTRATION_DISABLED',
          message: 'Local registration is disabled',
        }),
    });

    const { wrapper } = await mountRegister();

    expect(wrapper.get('[role="alert"]').text()).toContain('El registro está deshabilitado');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('sends the user to login after a successful registration', async () => {
    const calls = stubFetch({
      'POST /api/v1/auth/register': () =>
        jsonResponse(201, {
          userId: 'u1',
          email: 'ana@example.com',
          displayName: null,
          jira: { connected: false },
        }),
    });

    const { router } = await mountRegister();

    expect(calls[0]?.body).toEqual({ email: 'ana@example.com', password: 'a-strong-password' });
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.registered).toBe('1');
  });
});
