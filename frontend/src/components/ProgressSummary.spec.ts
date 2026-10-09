import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ALL_CANCELLED, NO_CHILDREN, NO_SUBTASKS, progress } from '@/test/fixtures';
import ProgressSummary from './ProgressSummary.vue';

const summary = (p = progress(), warnings?: string[]) =>
  mount(ProgressSummary, { props: { progress: p, warnings } });

describe('ProgressSummary', () => {
  it('lists done of total and every non-zero segment', () => {
    expect(summary().text()).toContain('7 of 12 done · 3 in progress · 2 pending · 1 cancelled');
  });

  it('omits zero segments except done/total', () => {
    const wrapper = summary(
      progress({ total: 4, completed: 0, inProgress: 0, pending: 4, cancelled: 0, percent: 0 }),
    );

    expect(wrapper.text()).toContain('0 of 4 done · 4 pending');
    expect(wrapper.text()).not.toContain('in progress');
    expect(wrapper.text()).not.toContain('cancelled');
  });

  it('shows an available-to-take segment only when there are available items', () => {
    expect(summary(progress({ available: 2 })).text()).toContain('2 available to take');
    expect(summary(progress({ available: 0 })).text()).not.toContain('available');
    expect(
      mount(ProgressSummary, {
        props: { progress: progress({ available: 2 }), hideAvailable: true },
      }).text(),
    ).not.toContain('available');
  });

  it('shows no unknown note when nothing is unknown', () => {
    expect(summary().text()).not.toContain('unknown');
  });

  it('notes items with unknown status, singular and plural', () => {
    expect(summary(progress({ unknown: 2 })).text()).toContain('2 items with unknown status');
    expect(summary(progress({ unknown: 1 })).text()).toContain('1 item with unknown status');
  });

  it('explains "none" per basis, never as zero progress', () => {
    const story = summary(NO_SUBTASKS);
    const epic = summary(NO_CHILDREN);

    expect(story.text()).toContain('No subtasks yet');
    expect(epic.text()).toContain('No children yet');
    expect(story.text()).not.toContain('0 of');
    expect(epic.text()).not.toContain('%');
  });

  it('explains that every item was cancelled', () => {
    const wrapper = summary(ALL_CANCELLED);

    expect(wrapper.text()).toContain('All items cancelled');
    expect(wrapper.text()).not.toContain('0 of');
  });

  it('shows an approximate notice with the warning text', () => {
    const wrapper = summary(progress({ isApproximate: true }), ['Children list truncated at 300']);

    const notice = wrapper.get('.alert--warning');
    expect(notice.text()).toContain('Approximate');
    expect(notice.text()).toContain('Children list truncated at 300');
  });

  it('shows an approximate notice with a default text when the flag has no warning', () => {
    const wrapper = summary(progress({ isApproximate: true }));

    expect(wrapper.get('.alert--warning').text()).toContain('Approximate');
    expect(wrapper.get('.alert--warning').text()).toContain('truncated');
  });

  it('shows warnings even without the approximate flag', () => {
    const wrapper = summary(progress(), ['1 item has an unrecognized status']);

    expect(wrapper.get('.alert--warning').text()).toContain('Approximate');
    expect(wrapper.get('.alert--warning').text()).toContain('1 item has an unrecognized status');
  });

  it('has no notice for a clean progress', () => {
    expect(summary().find('.alert').exists()).toBe(false);
  });
});
