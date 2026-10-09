import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.vue';

const badge = (categoryKey: string, name = 'Some status', isCancelled = false) =>
  mount(StatusBadge, {
    props: { status: { name, categoryKey: categoryKey as 'new', isCancelled } },
  });

describe('StatusBadge', () => {
  it.each(['new', 'indeterminate', 'done', 'unknown'])(
    'renders the %s category with its own class and the status name',
    (category) => {
      const wrapper = badge(category, 'In Review');

      expect(wrapper.classes()).toContain(`badge--${category}`);
      expect(wrapper.text()).toBe('In Review');
    },
  );

  it('shows cancelled as its own badge, never as done', () => {
    const wrapper = badge('done', 'Closed', true);

    expect(wrapper.text()).toBe('Cancelled');
    expect(wrapper.classes()).toContain('badge--cancelled');
    expect(wrapper.classes()).not.toContain('badge--done');
    expect(wrapper.text()).not.toContain('Done');
  });
});
