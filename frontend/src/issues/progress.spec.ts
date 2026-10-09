import { describe, expect, it } from 'vitest';
import { progress } from '@/test/fixtures';
import { MAX_STATIONS, lineTone, stationPlan } from './progress';

const drawn = (runs: ReturnType<typeof stationPlan>) => runs.reduce((n, r) => n + r.stations, 0);

describe('stationPlan', () => {
  it('draws one station per item in the order done, in progress, pending, cancelled', () => {
    const runs = stationPlan(progress());

    expect(runs).toEqual([
      { kind: 'done', count: 7, stations: 7 },
      { kind: 'inProgress', count: 3, stations: 3 },
      { kind: 'pending', count: 2, stations: 2 },
      { kind: 'cancelled', count: 1, stations: 1 },
    ]);
  });

  it('takes available items out of the pending run and draws them after it', () => {
    const runs = stationPlan(progress({ pending: 4, available: 3, inProgress: 0 }));

    expect(runs.map((r) => [r.kind, r.count])).toEqual([
      ['done', 7],
      ['pending', 1],
      ['available', 3],
      ['cancelled', 1],
    ]);
  });

  it('puts unknown items last and omits empty kinds', () => {
    const runs = stationPlan(progress({ unknown: 2, cancelled: 0, inProgress: 0, pending: 0 }));

    expect(runs.map((r) => r.kind)).toEqual(['done', 'unknown']);
  });

  it('keeps exact counts and caps the drawn stations when an item has many children', () => {
    const runs = stationPlan(
      progress({ completed: 33, inProgress: 10, pending: 20, available: 4, cancelled: 2 }),
    );

    expect(drawn(runs)).toBe(MAX_STATIONS);
    expect(runs.map((r) => r.count)).toEqual([33, 10, 16, 4, 2]);
    expect(runs.every((r) => r.stations >= 1 && r.stations <= r.count)).toBe(true);
    expect(runs[0]!.stations).toBeGreaterThan(runs[1]!.stations);
  });

  it('never drops a kind that has items, however small', () => {
    const runs = stationPlan(progress({ completed: 300, inProgress: 0, pending: 1, cancelled: 1 }));

    expect(runs.map((r) => r.kind)).toEqual(['done', 'pending', 'cancelled']);
    expect(drawn(runs)).toBe(MAX_STATIONS);
    expect(runs[1]!.stations).toBeGreaterThanOrEqual(1);
  });

  it('draws nothing when there is nothing to draw', () => {
    expect(
      stationPlan(progress({ completed: 0, inProgress: 0, pending: 0, cancelled: 0 })),
    ).toEqual([]);
  });

  it('honours a custom maximum', () => {
    expect(drawn(stationPlan(progress(), 6))).toBe(6);
  });
});

describe('lineTone', () => {
  it('is stable for a key and always one of the four inks', () => {
    expect(lineTone('MASIN-12')).toBe(lineTone('MASIN-12'));
    for (const key of ['MASIN-1', 'MASIN-2', 'MAADM-9', 'INC-100', '']) {
      expect([0, 1, 2, 3]).toContain(lineTone(key));
    }
  });

  it('spreads different keys over more than one ink', () => {
    const tones = new Set(Array.from({ length: 20 }, (_, i) => lineTone(`MASIN-${i}`)));
    expect(tones.size).toBeGreaterThan(1);
  });
});
