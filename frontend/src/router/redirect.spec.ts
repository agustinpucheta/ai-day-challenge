import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './redirect';

describe('sanitizeRedirect', () => {
  it.each([
    ['/settings', '/settings'],
    ['/settings?tab=1#x', '/settings?tab=1#x'],
    ['/', '/'],
  ])('keeps the internal path %s', (input, expected) => {
    expect(sanitizeRedirect(input)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    '',
    'https://evil.example.com',
    '//evil.example.com/path',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    'javascript:alert(1)',
    'settings',
    '/\tsettings',
    '/login',
    '/register?redirect=/x',
    ['/a', '/b'],
  ])('falls back to / for %j', (input) => {
    expect(sanitizeRedirect(input)).toBe('/');
  });
});
