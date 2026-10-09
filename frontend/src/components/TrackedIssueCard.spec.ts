import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { TrackedItem } from '@/tracking/useTrackedList';
import { epicItem, okItem, progress } from '@/test/fixtures';
import { createTestRouter } from '@/test/router';
import TrackedIssueCard from './TrackedIssueCard.vue';

const mountCard = (item: unknown, toneIndex = 0) =>
  mount(TrackedIssueCard, {
    props: {
      item: item as TrackedItem,
      expanded: false,
      removing: false,
      removeError: null,
      toneIndex,
    },
    global: { plugins: [createTestRouter()] },
  });

describe('TrackedIssueCard available chip', () => {
  it('shows "N available" for a story and an epic', () => {
    const story = mountCard(okItem('MASIN-1', { progress: progress({ available: 3 }) }));
    const epic = mountCard(
      epicItem('MASIN-2', 4, { progress: progress({ basis: 'children', available: 1 }) }),
    );

    expect(story.get('[data-testid="available-chip"]').text()).toBe('3 disponibles');
    expect(epic.get('[data-testid="available-chip"]').text()).toBe('1 disponible');
  });

  it('shows no chip when nothing is available', () => {
    expect(mountCard(okItem('MASIN-1')).find('[data-testid="available-chip"]').exists()).toBe(
      false,
    );
  });
});

describe('TrackedIssueCard transit line', () => {
  it('draws the progress as a line in the ink of its position, with the exact counts in words', () => {
    const first = mountCard(okItem('MASIN-1'));
    const third = mountCard(okItem('MASIN-1'), 2);

    const line = first.get('.line-progress');
    expect(line.attributes('data-tone')).toBe('0');
    expect(first.get('article').attributes('data-tone')).toBe('0');
    expect(third.get('.line-progress').attributes('data-tone')).toBe('2');
    expect(third.get('article').attributes('data-tone')).toBe('2');
    expect(first.get('[role="progressbar"]').attributes('aria-label')).toBe('Avance de MASIN-1');
    expect(first.text()).toContain('7 de 12 terminados · 3 en curso · 2 pendientes · 1 cancelado');
    expect(first.find('.tracked-card__tab').exists()).toBe(true);
  });

  it('draws a station for each available item', () => {
    const wrapper = mountCard(
      okItem('MASIN-1', { progress: progress({ pending: 3, available: 2 }) }),
    );

    expect(wrapper.findAll('[data-station="available"]')).toHaveLength(2);
  });
});
