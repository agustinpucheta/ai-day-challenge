import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.vue';

const badge = (
  categoryKey: string,
  name = 'Some status',
  isCancelled = false,
  isAvailable = false,
) =>
  mount(StatusBadge, {
    props: { status: { name, categoryKey: categoryKey as 'new', isCancelled, isAvailable } },
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

  it('shows an available status distinctly, keeping the real status name as text', () => {
    const wrapper = badge('new', 'Esperar Recurso', false, true);

    expect(wrapper.classes()).toContain('badge--available');
    expect(wrapper.classes()).not.toContain('badge--new');
    expect(wrapper.text()).toBe('Available · Esperar Recurso');
  });

  it('gives cancelled precedence over available', () => {
    const wrapper = badge('done', 'Esperar Recurso', true, true);

    expect(wrapper.text()).toBe('Cancelled');
    expect(wrapper.classes()).toContain('badge--cancelled');
  });

  it('draws the station form of the state before the name when asked to', () => {
    const wrapper = mount(StatusBadge, {
      props: {
        mark: true,
        status: { name: 'Closed', categoryKey: 'done', isCancelled: true, isAvailable: false },
      },
    });

    expect(wrapper.get('[data-station]').attributes('data-station')).toBe('cancelled');
    expect(wrapper.text()).toBe('Cancelled');
    expect(badge('new').find('[data-station]').exists()).toBe(false);
  });
});
