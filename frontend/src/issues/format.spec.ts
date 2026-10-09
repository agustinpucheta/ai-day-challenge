import { describe, expect, it } from 'vitest';
import { formatDateTime, formatTime, storyPointsDeviation } from './format';
import { countsText, displayPercent, formatPercent, noProgressText } from './progress';
import { progress } from '@/test/fixtures';
import { validateQuery } from './query';

describe('storyPointsDeviation', () => {
  it.each([
    [5, 3, '+2 vs planificados'],
    [2, 5, '-3 vs planificados'],
    [3.5, 3, '+0.5 vs planificados'],
    [3, 3, null],
    [null, 3, null],
    [3, null, null],
    [null, null, null],
  ])('final %s vs planificados %s -> %s', (final, planned, expected) => {
    expect(storyPointsDeviation(final, planned)).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it('formats a valid instant as es-AR day, month, year and 24h time', () => {
    const result = formatDateTime('2026-10-09T19:39:00.000Z', 'America/Argentina/Buenos_Aires');

    expect(result?.iso).toBe('2026-10-09T19:39:00.000Z');
    expect(result?.label).toMatch(/^9 de oct.? de 2026,? 16:39$/);
  });

  it('uses 24 hour time, never am/pm', () => {
    const label = formatDateTime('2026-10-09T21:05:00.000Z', 'UTC')?.label ?? '';

    expect(label).toContain('21:05');
    expect(label).not.toMatch(/[ap].? ?m/i);
  });

  it('rejects garbage', () => {
    expect(formatDateTime('not a date')).toBeNull();
  });
});

describe('formatTime', () => {
  it('formats a valid instant as 24h hours and minutes', () => {
    expect(formatTime('2026-10-09T19:39:00.000Z', 'America/Argentina/Buenos_Aires')).toBe('16:39');
    expect(formatTime('2026-10-09T00:05:00.000Z', 'UTC')).toBe('00:05');
  });

  it('rejects garbage', () => {
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
    expect(countsText(progress())).toBe(
      '7 de 12 terminados · 3 en curso · 2 pendientes · 1 cancelado',
    );
    expect(noProgressText(progress({ state: 'none', basis: 'none' }))).toBe('El avance no aplica');
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
