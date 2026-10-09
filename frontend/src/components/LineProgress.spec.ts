import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ALL_CANCELLED, NO_CHILDREN, NO_SUBTASKS, progress } from '@/test/fixtures';
import LineProgress from './LineProgress.vue';

const line = (p = progress(), toneIndex = 0, label = 'MASIN-1 progress') =>
  mount(LineProgress, { props: { progress: p, toneIndex, label } });

const kinds = (wrapper: ReturnType<typeof line>) =>
  wrapper.findAll('[data-station]').map((el) => el.attributes('data-station'));

describe('LineProgress stations', () => {
  it('draws one station per item, ordered done, in progress, pending, cancelled', () => {
    const wrapper = line();

    expect(kinds(wrapper)).toEqual([
      ...Array<string>(7).fill('done'),
      ...Array<string>(3).fill('inProgress'),
      ...Array<string>(2).fill('pending'),
      'cancelled',
    ]);
  });

  it('draws available stations after the pending ones and unknown last', () => {
    const wrapper = line(progress({ pending: 3, available: 2, unknown: 1, cancelled: 1 }));

    const drawn = kinds(wrapper);
    expect(drawn.filter((k) => k === 'pending')).toHaveLength(1);
    expect(drawn.filter((k) => k === 'available')).toHaveLength(2);
    expect(drawn.indexOf('available')).toBeGreaterThan(drawn.lastIndexOf('pending'));
    expect(drawn.indexOf('cancelled')).toBeGreaterThan(drawn.lastIndexOf('available'));
    expect(drawn.at(-1)).toBe('unknown');
  });

  it('draws the line solid up to the current position and dashed beyond it', () => {
    const wrapper = line(progress({ completed: 2, inProgress: 1, pending: 2, cancelled: 0 }));

    // 5 stations: segments lead into stations 2..5; those reaching done or in progress are solid
    const travelled = wrapper
      .findAll('.line-progress__segment')
      .map((el) => el.attributes('data-travelled') !== undefined);
    expect(travelled).toEqual([true, true, false, false]);
  });

  it('compresses to at most 24 stations while the exact counts stay in the label', () => {
    const big = progress({
      basis: 'children',
      total: 63,
      completed: 33,
      inProgress: 10,
      pending: 20,
      available: 4,
      cancelled: 2,
      percent: 49,
    });
    const wrapper = line(big);

    expect(wrapper.findAll('[data-station]')).toHaveLength(24);
    expect(wrapper.get('.line-progress').attributes('data-compressed')).toBe('true');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuetext')).toContain(
      '33 of 63 done · 10 in progress · 20 pending · 2 cancelled',
    );
    expect(kinds(wrapper)).toContain('available');
    expect(kinds(wrapper)).toContain('cancelled');
  });

  it('does not flag a line that fits without compression', () => {
    expect(line().get('.line-progress').attributes('data-compressed')).toBeUndefined();
  });
});

describe('LineProgress percent and accessibility', () => {
  it('exposes a progressbar whose value matches the percent', () => {
    const el = line(progress({ percent: 58.3 })).get('[role="progressbar"]');

    expect(el.attributes('aria-valuenow')).toBe('58.3');
    expect(el.attributes('aria-valuemin')).toBe('0');
    expect(el.attributes('aria-valuemax')).toBe('100');
    expect(el.attributes('aria-label')).toBe('MASIN-1 progress');
    expect(el.attributes('aria-valuetext')).toBe(
      '58.3%, 7 of 12 done · 3 in progress · 2 pending · 1 cancelled',
    );
  });

  it('hides the stations from assistive technology', () => {
    expect(line().get('.line-progress__rail').attributes('aria-hidden')).toBe('true');
  });

  it('prints the percent with one decimal only when needed', () => {
    expect(
      line(progress({ percent: 33.3 }))
        .get('.line-progress__percent')
        .text(),
    ).toBe('33.3%');
    expect(
      line(progress({ percent: 100 }))
        .get('.line-progress__percent')
        .text(),
    ).toBe('100%');
    expect(
      line(progress({ percent: 0 }))
        .get('.line-progress__percent')
        .text(),
    ).toBe('0%');
  });

  it('wraps the tone around the four line inks', () => {
    expect(line(progress(), 2).get('.line-progress').attributes('data-tone')).toBe('2');
    expect(line(progress(), 5).get('.line-progress').attributes('data-tone')).toBe('1');
    expect(line(progress(), -1).get('.line-progress').attributes('data-tone')).toBe('3');
  });
});

describe('LineProgress without an honest percentage', () => {
  it.each([
    ['no subtasks', NO_SUBTASKS, 'none'],
    ['no children', NO_CHILDREN, 'none'],
    ['all cancelled', ALL_CANCELLED, 'all_cancelled'],
  ])('never shows a percent, a progressbar or a station for %s', (_name, p, state) => {
    const wrapper = line(p);

    expect(wrapper.get('.line-progress').attributes('data-state')).toBe(state);
    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.html()).not.toContain('aria-valuenow');
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-station]')).toHaveLength(0);
  });

  it('draws a struck line for all cancelled and an empty dotted line for none', () => {
    expect(line(ALL_CANCELLED).find('.line-progress__mark--all_cancelled').exists()).toBe(true);
    expect(line(NO_SUBTASKS).find('.line-progress__mark').exists()).toBe(false);
    expect(line(NO_SUBTASKS).find('.line-progress__segment--empty').exists()).toBe(true);
  });

  it('does not render a number for an ok state whose percent is missing', () => {
    const wrapper = line(progress({ percent: null }));

    expect(wrapper.text()).not.toContain('%');
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
  });

  it('draws a broken line, with no figure at all, when the read failed', () => {
    const wrapper = mount(LineProgress, { props: { broken: true, label: 'MASIN-1 progress' } });

    expect(wrapper.get('.line-progress').attributes('data-state')).toBe('broken');
    expect(wrapper.find('.line-progress__mark--broken').exists()).toBe(true);
    expect(wrapper.find('.line-progress__percent').exists()).toBe(false);
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('prefers the broken line over any progress it is given', () => {
    const wrapper = mount(LineProgress, {
      props: { broken: true, progress: progress(), label: 'x' },
    });

    expect(wrapper.get('.line-progress').attributes('data-state')).toBe('broken');
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-station]')).toHaveLength(0);
  });
});
