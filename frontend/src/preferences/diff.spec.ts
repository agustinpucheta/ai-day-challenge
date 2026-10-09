import { describe, expect, it } from 'vitest';
import type { Preferences } from '@/api/client';
import { diffPreferences, toForm } from './diff';

const stored: Preferences = {
  weekStartsOn: 'monday',
  timezone: null,
  showWeeklySp: true,
  showSubtasks: true,
  showDependencies: false,
  updatedAt: '2026-10-09T12:00:00.000Z',
};

describe('diffPreferences', () => {
  it('returns an empty update when nothing changed', () => {
    expect(diffPreferences(stored, toForm(stored))).toEqual({});
  });

  it('includes only changed whitelisted fields', () => {
    const form = { ...toForm(stored), showDependencies: true, timezone: ' Europe/Madrid ' };

    expect(diffPreferences(stored, form)).toEqual({
      showDependencies: true,
      timezone: 'Europe/Madrid',
    });
  });

  it('sends null to clear the timezone', () => {
    const withTz = { ...stored, timezone: 'Europe/Madrid' };

    expect(diffPreferences(withTz, { ...toForm(withTz), timezone: '  ' })).toEqual({
      timezone: null,
    });
  });

  it('never sends read-only or unknown fields', () => {
    const form = { ...toForm(stored), updatedAt: 'x', userId: 'other' } as ReturnType<
      typeof toForm
    >;

    expect(diffPreferences(stored, form)).toEqual({});
  });
});
