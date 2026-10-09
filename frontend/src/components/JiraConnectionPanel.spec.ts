import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import JiraConnectionPanel from './JiraConnectionPanel.vue';

describe('JiraConnectionPanel', () => {
  it('renders the disconnected state with a disabled connect button', () => {
    const wrapper = mount(JiraConnectionPanel, { props: { status: 'disconnected' } });

    expect(wrapper.text()).toContain('Not connected');
    const button = wrapper.get('button');
    expect(button.text()).toBe('Connect Jira');
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('available in Phase 2');
  });

  it('renders the loading state', () => {
    const wrapper = mount(JiraConnectionPanel, { props: { status: 'loading' } });

    expect(wrapper.get('[aria-busy="true"]').text()).toContain('Checking');
  });

  it('renders the error message and lets the user retry', async () => {
    const wrapper = mount(JiraConnectionPanel, {
      props: { status: 'error', errorMessage: 'Cannot reach the server.' },
    });

    expect(wrapper.get('[role="alert"]').text()).toContain('Cannot reach the server.');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});
