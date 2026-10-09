import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createTestRouter } from '@/test/router';
import IssueTable from './IssueTable.vue';

const issue = (key: string, isAvailable: boolean) => ({
  key,
  summary: `Summary ${key}`,
  status: {
    name: isAvailable ? 'Esperar Recurso' : 'Open',
    categoryKey: 'new' as const,
    isCancelled: false,
    isAvailable,
  },
  url: `https://acme.atlassian.net/browse/${key}`,
});

const mountTable = (availableFilter: boolean, rows = [issue('A-1', true), issue('A-2', false)]) =>
  mount(IssueTable, {
    props: { issues: rows, caption: 'Subtasks', availableFilter },
    global: { plugins: [createTestRouter()] },
  });

describe('IssueTable', () => {
  it('has no filter unless asked for, and shows the Available badge', () => {
    const wrapper = mountTable(false);

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Disponible · Esperar Recurso');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
  });

  it('filters subtasks to the available ones', async () => {
    const wrapper = mountTable(true);

    await wrapper.get('input[type="checkbox"]').setValue(true);

    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.get('tbody tr').classes()).toContain('is-available');
  });

  it('shows the empty copy when nothing is available', async () => {
    const wrapper = mountTable(true, [issue('A-2', false)]);

    await wrapper.get('input[type="checkbox"]').setValue(true);

    expect(wrapper.text()).toContain('No hay ítems disponibles');
  });
});
