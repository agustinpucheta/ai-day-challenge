import { mapWithConcurrency } from './concurrency';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('mapWithConcurrency', () => {
  it('never runs more than the limit in flight and keeps the input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = await mapWithConcurrency(items, 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await tick();
      await tick();
      inFlight -= 1;
      return item * 2;
    });
    expect(peak).toBe(3);
    expect(result).toEqual(items.map((i) => i * 2));
  });

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapWithConcurrency([], 4, () => Promise.resolve(1))).toEqual([]);
    expect(await mapWithConcurrency(['a'], 10, (s) => Promise.resolve(s))).toEqual(['a']);
  });
});
