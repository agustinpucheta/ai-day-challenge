import { describe, expect, it } from 'vitest';
import { formatDateTime, formatTime, storyPointsDeviation } from './format';
import { countsText, displayPercent, formatPercent, noProgressText } from './progress';
import { progress } from '@/test/fixtures';
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

describe('formatTime', () => {
  it('formats a valid instant and rejects garbage', () => {
    expect(formatTime('2026-10-09T12:00:00.000Z')).toMatch(/\d/);
    expect(formatTime('not a date')).toBeNull();
  });
});

describe('progress formatting', () => {
  it.each([
    [33.3, '33.3%'],
    [100, '100%'],
    [50, '50%'],
    [0, '0%'],
    [66.66, '66.7%'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });

  it('draws a percent only for an ok state, clamped to 0-100', () => {
    expect(displayPercent(progress({ percent: 42.5 }))).toBe(42.5);
    expect(displayPercent(progress({ percent: 120 }))).toBe(100);
    expect(displayPercent(progress({ percent: -3 }))).toBe(0);
    expect(displayPercent(progress({ state: 'none', percent: null }))).toBeNull();
    expect(displayPercent(progress({ state: 'all_cancelled', percent: 0 }))).toBeNull();
    expect(displayPercent(progress({ percent: null }))).toBeNull();
  });

  it('describes counts and the absence of progress', () => {
    expect(countsText(progress())).toBe('7 of 12 done · 3 in progress · 2 pending · 1 cancelled');
    expect(noProgressText(progress({ state: 'none', basis: 'none' }))).toBe(
      'Progress does not apply',
    );
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
