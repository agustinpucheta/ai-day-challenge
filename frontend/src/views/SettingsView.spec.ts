import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { jsonResponse, stubFetch } from '@/test/http';
import SettingsView from './SettingsView.vue';

const stored = {
  weekStartsOn: 'monday',
  timezone: 'America/Argentina/Buenos_Aires',
  showWeeklySp: true,
  showSubtasks: true,
  showDependencies: true,
  updatedAt: '2026-10-09T12:00:00.000Z',
};

describe('SettingsView', () => {
  it('loads the preferences and PATCHes only the changed fields', async () => {
    const calls = stubFetch({
      'GET /api/v1/users/me/preferences': () => jsonResponse(200, stored),
      'PATCH /api/v1/users/me/preferences': () =>
        jsonResponse(200, { ...stored, showSubtasks: false, weekStartsOn: 'sunday' }),
    });
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect((wrapper.get('#pref-timezone').element as HTMLInputElement).value).toBe(
      'America/Argentina/Buenos_Aires',
    );
    await wrapper.get('#pref-show-subtasks').setValue(false);
    await wrapper.get('#pref-week-start').setValue('sunday');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({ showSubtasks: false, weekStartsOn: 'sunday' });
    expect(wrapper.get('[role="status"]').text()).toContain('Preferences saved');
  });

  it('does not send a request when nothing changed', async () => {
    const calls = stubFetch({
      'GET /api/v1/users/me/preferences': () => jsonResponse(200, stored),
    });
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  });

  it('shows the error message when the preferences cannot be loaded', async () => {
    stubFetch({
      'GET /api/v1/users/me/preferences': () =>
        jsonResponse(503, { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' }),
    });
    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('Database unavailable');
    expect(wrapper.find('form').exists()).toBe(false);
  });
});
