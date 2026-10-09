import { computeProgress, type ProgressItem, type ProgressResult } from './progress';

type Kind = 'done' | 'indeterminate' | 'new' | 'unknown' | 'cancelled';

function items(...kinds: Kind[]): ProgressItem[] {
  return kinds.map((kind, index) => ({
    key: `DEMO-${index + 1}`,
    status:
      kind === 'cancelled'
        ? { categoryKey: 'done', isCancelled: true }
        : { categoryKey: kind, isCancelled: false },
  }));
}

const repeat = (kind: Kind, times: number): Kind[] => Array.from({ length: times }, () => kind);

const counts = (r: ProgressResult) => ({
  total: r.total,
  completed: r.completed,
  inProgress: r.inProgress,
  pending: r.pending,
  cancelled: r.cancelled,
  unknown: r.unknown,
});

const c = (
  total: number,
  completed: number,
  inProgress: number,
  pending: number,
  cancelled: number,
  unknown: number,
) => ({ total, completed, inProgress, pending, cancelled, unknown });

describe('computeProgress', () => {
  it.each<[string, Kind[], ReturnType<typeof counts>, number | null, string]>([
    ['empty', [], c(0, 0, 0, 0, 0, 0), null, 'none'],
    ['single done', ['done'], c(1, 1, 0, 0, 0, 0), 100, 'ok'],
    ['single pending', ['new'], c(1, 0, 0, 1, 0, 0), 0, 'ok'],
    ['all done', ['done', 'done', 'done'], c(3, 3, 0, 0, 0, 0), 100, 'ok'],
    ['none done', ['new', 'indeterminate'], c(2, 0, 1, 1, 0, 0), 0, 'ok'],
    ['mixed', ['done', 'indeterminate', 'new', 'new'], c(4, 1, 1, 2, 0, 0), 25, 'ok'],
    ['cancelled only', ['cancelled', 'cancelled'], c(0, 0, 0, 0, 2, 0), null, 'all_cancelled'],
    ['cancelled mixed (excluded)', ['done', 'cancelled', 'new'], c(2, 1, 0, 1, 1, 0), 50, 'ok'],
    ['unknown category', ['done', 'unknown'], c(2, 1, 0, 0, 0, 1), 50, 'ok'],
    ['only unknown', ['unknown'], c(1, 0, 0, 0, 0, 1), 0, 'ok'],
  ])('%s', (_label, kinds, expected, percent, state) => {
    const result = computeProgress(items(...kinds), { basis: 'subtasks' });
    expect(counts(result)).toEqual(expected);
    expect(result.percent).toBe(percent);
    expect(result.state).toBe(state);
    expect(result.basis).toBe('subtasks');
    expect(result.completed + result.inProgress + result.pending + result.unknown).toBe(
      result.total,
    );
  });

  it.each<[Kind[], number]>([
    [['done', 'new', 'new'], 33.3],
    [['done', 'done', 'new'], 66.7],
    [['done'], 100],
    [[...repeat('done', 1), ...repeat('new', 6)], 14.3],
    [[...repeat('done', 5), ...repeat('new', 1)], 83.3],
    [[...repeat('done', 1), ...repeat('new', 7)], 12.5],
  ])('rounds %j to one decimal (%d)', (kinds, percent) => {
    expect(computeProgress(items(...kinds), { basis: 'children' }).percent).toBe(percent);
  });

  it('never double counts the same key and keeps the first occurrence', () => {
    const list: ProgressItem[] = [
      { key: 'DEMO-1', status: { categoryKey: 'done', isCancelled: false } },
      { key: 'DEMO-1', status: { categoryKey: 'new', isCancelled: false } },
      { key: 'DEMO-2', status: { categoryKey: 'new', isCancelled: false } },
    ];
    const result = computeProgress(list, { basis: 'children' });
    expect(result).toMatchObject({ total: 2, completed: 1, pending: 1, percent: 50 });
  });

  it('handles large lists', () => {
    const kinds = [
      ...repeat('done', 1234),
      ...repeat('new', 4321),
      ...repeat('indeterminate', 445),
    ];
    const result = computeProgress(items(...kinds), { basis: 'children' });
    expect(result).toMatchObject({ total: 6000, completed: 1234, percent: 20.6 });
  });

  describe('cancelledCountsInDenominator', () => {
    it('counts cancelled as not completed when enabled', () => {
      const result = computeProgress(items('done', 'cancelled', 'new'), {
        basis: 'subtasks',
        cancelledCountsInDenominator: true,
      });
      expect(result).toMatchObject({
        total: 3,
        completed: 1,
        cancelled: 1,
        percent: 33.3,
        state: 'ok',
      });
    });

    it('is 0% (ok) rather than all_cancelled when enabled and everything is cancelled', () => {
      const result = computeProgress(items('cancelled'), {
        basis: 'subtasks',
        cancelledCountsInDenominator: true,
      });
      expect(result).toMatchObject({ total: 1, completed: 0, percent: 0, state: 'ok' });
    });

    it('excludes cancelled by default (D-024)', () => {
      const result = computeProgress(items('done', 'cancelled'), { basis: 'subtasks' });
      expect(result).toMatchObject({ total: 1, percent: 100, cancelled: 1 });
    });
  });
});
