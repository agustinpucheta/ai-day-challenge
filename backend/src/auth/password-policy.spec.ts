import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isPasswordAcceptable } from './password-policy';

describe('password policy', () => {
  it('requires at least 12 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(isPasswordAcceptable('a'.repeat(11))).toBe(false);
    expect(isPasswordAcceptable('a'.repeat(12))).toBe(true);
  });

  it('rejects passwords above the maximum length to bound hashing cost', () => {
    expect(isPasswordAcceptable('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true);
    expect(isPasswordAcceptable('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it('rejects passwords made only of whitespace', () => {
    expect(isPasswordAcceptable(' '.repeat(20))).toBe(false);
  });
});
