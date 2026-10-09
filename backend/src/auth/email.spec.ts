import { normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeEmail('  Ana.Perez@Example.COM \t')).toBe('ana.perez@example.com');
  });

  it('keeps an already normalized email unchanged', () => {
    expect(normalizeEmail('ana@example.com')).toBe('ana@example.com');
  });

  it('maps differently cased variants to the same value', () => {
    expect(normalizeEmail('ANA@example.com')).toBe(normalizeEmail('ana@EXAMPLE.com'));
  });
});
