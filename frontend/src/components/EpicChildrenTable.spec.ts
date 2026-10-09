import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { DashboardChild } from '@/api/client';
import { childBody, inProgressStatus, progress } from '@/test/fixtures';
import { createTestRouter } from '@/test/router';
import EpicChildrenTable from './EpicChildrenTable.vue';

const availableStatus = {
  name: 'Esperar Recurso',
  categoryKey: 'new',
  isCancelled: false,
  isAvailable: true,
};

const children = [
  childBody('MASIN-1', { status: availableStatus, progress: progress({ available: 2 }) }),
  childBody('MASIN-2', { status: inProgressStatus }),
] as DashboardChild[];

const mountTable = (rows = children) =>
  mount(EpicChildrenTable, {
    props: { children: rows, caption: 'Stories' },
    global: { plugins: [createTestRouter()] },
  });

const keys = (wrapper: ReturnType<typeof mountTable>) =>
  wrapper.findAll('tbody tr').map((row) => row.find('a').text());

describe('EpicChildrenTable available filter', () => {
  it('shows every row by default and highlights only the available ones', () => {
    const wrapper = mountTable();

    expect(keys(wrapper)).toEqual(['MASIN-1', 'MASIN-2']);
    const [first, second] = wrapper.findAll('tbody tr');
    expect(first?.classes()).toContain('is-available');
    expect(second?.classes()).not.toContain('is-available');
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false);
  });

  it('shows the per-story available count as a chip', () => {
    const chips = mountTable().findAll('[data-testid="available-chip"]');

    expect(chips.map((chip) => chip.text())).toEqual(['2 disponibles']);
  });

  it('filters to available rows when "Solo disponibles" is checked', async () => {
    const wrapper = mountTable();

    await wrapper.get('input[type="checkbox"]').setValue(true);

    expect(keys(wrapper)).toEqual(['MASIN-1']);
    expect(wrapper.text()).toContain('Solo disponibles');
  });

  it('explains an empty filtered list', async () => {
    const wrapper = mountTable([children[1] as DashboardChild]);

    await wrapper.get('input[type="checkbox"]').setValue(true);

    expect(wrapper.find('table').exists()).toBe(false);
    expect(wrapper.text()).toContain('No hay ítems disponibles');
  });
});
