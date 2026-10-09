import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { JiraConnectionState, JiraErrorReason } from '@/jira/useJiraConnection';
import JiraConnectionPanel from './JiraConnectionPanel.vue';

function render(state: JiraConnectionState) {
  return mount(JiraConnectionPanel, { props: { state } });
}

describe('JiraConnectionPanel', () => {
  it('renders loading as a busy region', () => {
    const wrapper = render({ kind: 'loading' });

    expect(wrapper.text()).toContain('Cargando el estado de la conexión');
    expect(wrapper.get('section').attributes('aria-busy')).toBe('true');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('explains how to configure the backend without showing any value', () => {
    const wrapper = render({ kind: 'not_configured' });

    expect(wrapper.text()).toContain('No configurado');
    for (const name of ['JIRA_URL', 'JIRA_USERNAME', 'JIRA_API_TOKEN', 'reiniciá el backend']) {
      expect(wrapper.text()).toContain(name);
    }
    expect(wrapper.text()).not.toContain('Conectado');
  });

  it('offers a manual verification when configured but not verified', async () => {
    const wrapper = render({ kind: 'configured', siteUrl: 'https://acme.atlassian.net' });

    expect(wrapper.text()).toContain('Configurado, sin verificar');
    expect(wrapper.get('button').text()).toBe('Verificar conexión');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('verify')).toHaveLength(1);
  });

  it('renders verifying as busy', () => {
    const wrapper = render({ kind: 'verifying', siteUrl: 'https://acme.atlassian.net' });

    expect(wrapper.text()).toContain('Verificando');
    expect(wrapper.get('section').attributes('aria-busy')).toBe('true');
  });

  it('renders the connected identity, site and last-checked time, and re-verifies on demand', async () => {
    const wrapper = render({
      kind: 'connected',
      siteUrl: 'https://acme.atlassian.net',
      displayName: 'Ada Lovelace',
      checkedAt: '2026-10-09T12:00:00.000Z',
    });

    expect(wrapper.text()).toContain('Conectado');
    expect(wrapper.text()).toContain('Ada Lovelace');
    expect(wrapper.text()).toContain('https://acme.atlassian.net');
    expect(wrapper.text()).toContain('Última verificación');
    expect(wrapper.get('time').attributes('datetime')).toBe('2026-10-09T12:00:00.000Z');
    expect(wrapper.get('section').attributes('aria-busy')).toBe('false');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('verify')).toHaveLength(1);
  });

  it.each<[JiraErrorReason, string]>([
    ['reauth_required', 'Jira rechazó el token de API'],
    ['forbidden', 'Jira denegó el acceso'],
    ['rate_limited', 'Jira está limitando los pedidos'],
    ['unavailable', 'Jira no está disponible'],
    ['network', 'No se pudo conectar con el servidor'],
    ['unknown', 'Algo salió mal'],
  ])('renders the %s error with its own message', (reason, title) => {
    const wrapper = render({ kind: 'error', reason, retry: 'verify', siteUrl: null });

    expect(wrapper.get('[role="alert"]').text()).toContain(title);
    expect(wrapper.text()).not.toContain('Conectado');
  });

  it('tells the user how to replace a rejected token', () => {
    const wrapper = render({
      kind: 'error',
      reason: 'reauth_required',
      retry: 'verify',
      siteUrl: null,
    });

    expect(wrapper.text()).toContain(
      'Creá un token nuevo en id.atlassian.com → Seguridad → Tokens de API, actualizá JIRA_API_TOKEN y reiniciá el backend.',
    );
  });

  it('shows the retry-after segundos only for rate limiting', () => {
    const limited = render({
      kind: 'error',
      reason: 'rate_limited',
      retry: 'verify',
      siteUrl: null,
      retryAfterSeconds: 42,
    });
    const unavailable = render({
      kind: 'error',
      reason: 'unavailable',
      retry: 'verify',
      siteUrl: null,
      retryAfterSeconds: 42,
    });

    expect(limited.text()).toContain('Reintentá en 42 segundos');
    expect(unavailable.text()).not.toContain('Reintentá en');
  });

  it('retries by re-verifying or by reloading depending on what failed', async () => {
    const verifying = render({
      kind: 'error',
      reason: 'unavailable',
      retry: 'verify',
      siteUrl: null,
    });
    const reloading = render({ kind: 'error', reason: 'network', retry: 'reload', siteUrl: null });

    await verifying.get('button').trigger('click');
    await reloading.get('button').trigger('click');

    expect(verifying.emitted('verify')).toHaveLength(1);
    expect(verifying.emitted('reload')).toBeUndefined();
    expect(reloading.emitted('reload')).toHaveLength(1);
    expect(reloading.emitted('verify')).toBeUndefined();
  });
});
