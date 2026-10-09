import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StateLegend from './StateLegend.vue';

describe('StateLegend', () => {
  it('names every station form in drawing order', () => {
    const wrapper = mount(StateLegend);

    const items = wrapper.findAll('li');
    expect(items.map((li) => li.attributes('data-kind'))).toEqual([
      'done',
      'inProgress',
      'pending',
      'available',
      'cancelled',
      'unknown',
    ]);
    expect(items.map((li) => li.text())).toEqual([
      'Terminado',
      'En curso',
      'Pendiente',
      'Disponible para tomar',
      'Cancelado',
      'Estado desconocido',
    ]);
  });

  it('is a labelled list with one decorative station per entry', () => {
    const wrapper = mount(StateLegend);

    expect(wrapper.get('ul').attributes('aria-label')).toBe('Leyenda de estados');
    expect(wrapper.findAll('svg[aria-hidden="true"]')).toHaveLength(6);
  });
});
