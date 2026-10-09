import { describe, expect, it } from 'vitest';
import { formatDateTime, storyPointsDeviation } from './format';
import { validateQuery } from './query';

describe('storyPointsDeviation', () => {
  it.each([
    [5, 3, '+2 vs planned'],
    [2, 5, '-3 vs planned'],
    [3.5, 3, '+0.5 vs planned'],
    [3, 3, null],
    [null, 3, null],
    [3, null, null],
    [null, null, null],
  ])('final %s vs planned %s -> %s', (final, planned, expected) => {
    expect(storyPointsDeviation(final, planned)).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it('formats a valid instant and rejects garbage', () => {
    expect(formatDateTime('2026-10-09T12:00:00.000Z')?.iso).toBe('2026-10-09T12:00:00.000Z');
    expect(formatDateTime('not a date')).toBeNull();
  });
});

describe('validateQuery', () => {
  it('trims and enforces 2-100 characters without control characters', () => {
    expect(validateQuery('  a ')).not.toBeNull();
    expect(validateQuery('ab')).toBeNull();
    expect(validateQuery('x'.repeat(101))).not.toBeNull();
    expect(validateQuery('ab\u0007c')).not.toBeNull();
    expect(validateQuery(undefined)).not.toBeNull();
  });
});
