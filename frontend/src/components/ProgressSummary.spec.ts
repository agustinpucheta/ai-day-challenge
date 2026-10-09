import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ALL_CANCELLED, NO_CHILDREN, NO_SUBTASKS, progress } from '@/test/fixtures';
import ProgressSummary from './ProgressSummary.vue';

const summary = (p = progress(), warnings?: string[]) =>
  mount(ProgressSummary, { props: { progress: p, warnings } });

describe('ProgressSummary', () => {
  it('lists done of total and every non-zero segment', () => {
    expect(summary().text()).toContain(
      '7 de 12 terminados · 3 en curso · 2 pendientes · 1 cancelado',
    );
  });

  it('omits zero segments except done/total', () => {
    const wrapper = summary(
      progress({ total: 4, completed: 0, inProgress: 0, pending: 4, cancelled: 0, percent: 0 }),
    );

    expect(wrapper.text()).toContain('0 de 4 terminados · 4 pendientes');
    expect(wrapper.text()).not.toContain('en curso');
    expect(wrapper.text()).not.toContain('cancelado');
  });

  it('shows an available-to-take segment only when there are available items', () => {
    expect(summary(progress({ available: 2 })).text()).toContain('2 disponibles para tomar');
    expect(summary(progress({ available: 0 })).text()).not.toContain('disponible');
    expect(
      mount(ProgressSummary, {
        props: { progress: progress({ available: 2 }), hideAvailable: true },
      }).text(),
    ).not.toContain('disponible');
  });

  it('shows no unknown note when nothing is unknown', () => {
    expect(summary().text()).not.toContain('desconocido');
  });

  it('notes items with unknown status, singular and plural', () => {
    expect(summary(progress({ unknown: 2 })).text()).toContain('2 ítems con estado desconocido');
    expect(summary(progress({ unknown: 1 })).text()).toContain('1 ítem con estado desconocido');
  });

  it('explains "none" per basis, never as zero progress', () => {
    const story = summary(NO_SUBTASKS);
    const epic = summary(NO_CHILDREN);

    expect(story.text()).toContain('Todavía sin subtareas');
    expect(epic.text()).toContain('Todavía sin hijos');
    expect(story.text()).not.toContain('0 of');
    expect(epic.text()).not.toContain('%');
  });

  it('explains that every item was cancelled', () => {
    const wrapper = summary(ALL_CANCELLED);

    expect(wrapper.text()).toContain('Todos cancelados');
    expect(wrapper.text()).not.toContain('0 of');
  });

  it('shows an approximate notice with the warning text', () => {
    const wrapper = summary(progress({ isApproximate: true }), ['Children list truncated at 300']);

    const notice = wrapper.get('.alert--warning');
    expect(notice.text()).toContain('Avance aproximado');
    expect(notice.text()).toContain('Children list truncated at 300');
  });

  it('shows an approximate notice with a default text when the flag has no warning', () => {
    const wrapper = summary(progress({ isApproximate: true }));

    expect(wrapper.get('.alert--warning').text()).toContain('Avance aproximado');
    expect(wrapper.get('.alert--warning').text()).toContain('truncó');
  });

  it('shows warnings even without the approximate flag', () => {
    const wrapper = summary(progress(), ['1 item has an unrecognized status']);

    expect(wrapper.get('.alert--warning').text()).toContain('Avance aproximado');
    expect(wrapper.get('.alert--warning').text()).toContain('1 item has an unrecognized status');
  });

  it('has no notice for a clean progress', () => {
    expect(summary().find('.alert').exists()).toBe(false);
  });
});
