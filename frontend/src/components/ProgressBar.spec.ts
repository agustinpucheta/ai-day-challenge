import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ALL_CANCELLED, NO_CHILDREN, NO_SUBTASKS, progress } from '@/test/fixtures';
import ProgressBar from './ProgressBar.vue';

const bar = (p = progress(), label = 'MASIN-1 progress') =>
  mount(ProgressBar, { props: { progress: p, label } });

describe('ProgressBar', () => {
  it('exposes an accessible progressbar whose value matches the percent', () => {
    const wrapper = bar(progress({ percent: 58.3 }));

    const el = wrapper.get('[role="progressbar"]');
    expect(el.attributes('aria-valuenow')).toBe('58.3');
    expect(el.attributes('aria-valuemin')).toBe('0');
    expect(el.attributes('aria-valuemax')).toBe('100');
    expect(el.attributes('aria-label')).toBe('MASIN-1 progress');
    expect(el.attributes('aria-valuetext')).toBe('58.3%');
    expect(wrapper.get('.progress__fill').attributes('style')).toContain('width: 58.3%');
  });

  it('shows the percent with one decimal only when needed', () => {
    expect(bar(progress({ percent: 33.3 })).text()).toBe('33.3%');
    expect(bar(progress({ percent: 100 })).text()).toBe('100%');
    expect(bar(progress({ percent: 50 })).text()).toBe('50%');
    expect(bar(progress({ percent: 0 })).text()).toBe('0%');
  });

  it('marks a complete bar with its own state', () => {
    expect(
      bar(progress({ percent: 100 }))
        .get('.progress')
        .attributes('data-state'),
    ).toBe('complete');
    expect(
      bar(progress({ percent: 40 }))
        .get('.progress')
        .attributes('data-state'),
    ).toBe('ok');
  });

  it.each([
    ['none (story)', NO_SUBTASKS, 'none'],
    ['none (epic)', NO_CHILDREN, 'none'],
    ['all cancelled', ALL_CANCELLED, 'all_cancelled'],
  ])('never shows a percentage or a progressbar value for %s', (_name, p, state) => {
    const wrapper = bar(p);

    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.html()).not.toContain('aria-valuenow');
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(wrapper.find('.progress__fill').exists()).toBe(false);
    expect(wrapper.get('.progress').attributes('data-state')).toBe(state);
  });

  it('does not render a number for an ok state whose percent is missing', () => {
    const wrapper = bar(progress({ percent: null }));

    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
  });

  it('supports a compact size', () => {
    const wrapper = mount(ProgressBar, {
      props: { progress: progress(), label: 'x', size: 'sm' },
    });

    expect(wrapper.get('.progress').classes()).toContain('progress--sm');
  });
});
