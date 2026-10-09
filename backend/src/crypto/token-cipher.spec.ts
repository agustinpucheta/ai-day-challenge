import { randomBytes } from 'node:crypto';
import { TokenCipher, TokenDecryptionError } from './token-cipher';

const key = (): Buffer => randomBytes(32);
const AAD = 'connection-1';

function cipherWith(currentVersion = 1, keys: Record<number, Buffer> = { 1: key() }): TokenCipher {
  return new TokenCipher({ currentVersion, keys });
}

/** Changes the first character of one base64url segment of the envelope. */
function tamper(envelope: string, segment: number): string {
  const parts = envelope.split('.');
  const value = parts[segment] ?? '';
  parts[segment] = (value.startsWith('A') ? 'B' : 'A') + value.slice(1);
  return parts.join('.');
}

describe('TokenCipher', () => {
  it('round-trips a token and reports the key version', () => {
    const cipher = cipherWith(3, { 3: key() });
    const envelope = cipher.encrypt('refresh-token-value', AAD);
    expect(envelope.split('.').slice(0, 2)).toEqual(['v1', '3']);
    expect(cipher.decrypt(envelope, AAD)).toBe('refresh-token-value');
    expect(cipher.currentVersion).toBe(3);
  });

  it('uses a fresh random IV for every encryption', () => {
    const cipher = cipherWith();
    const first = cipher.encrypt('same', AAD);
    const second = cipher.encrypt('same', AAD);
    expect(first).not.toBe(second);
    expect(first.split('.')[2]).not.toBe(second.split('.')[2]);
  });

  it.each([
    ['iv', 2],
    ['tag', 3],
    ['ciphertext', 4],
  ])('rejects a tampered %s', (_name, segment) => {
    const cipher = cipherWith();
    const envelope = cipher.encrypt('secret-token', AAD);
    expect(() => cipher.decrypt(tamper(envelope, segment), AAD)).toThrow(TokenDecryptionError);
  });

  it('rejects a different AAD (ciphertext copied between rows)', () => {
    const cipher = cipherWith();
    const envelope = cipher.encrypt('secret-token', 'connection-1');
    expect(() => cipher.decrypt(envelope, 'connection-2')).toThrow(TokenDecryptionError);
  });

  it('rejects a different key with the same version', () => {
    const envelope = cipherWith().encrypt('secret-token', AAD);
    expect(() => cipherWith().decrypt(envelope, AAD)).toThrow(TokenDecryptionError);
  });

  it('decrypts data written with a previous key version', () => {
    const oldKey = key();
    const envelope = cipherWith(1, { 1: oldKey }).encrypt('old-token', AAD);
    const rotated = cipherWith(2, { 1: oldKey, 2: key() });
    expect(rotated.decrypt(envelope, AAD)).toBe('old-token');
    expect(rotated.encrypt('new', AAD).split('.')[1]).toBe('2');
  });

  it('rejects an unknown key version and malformed envelopes', () => {
    const cipher = cipherWith();
    const envelope = cipher.encrypt('secret-token', AAD);
    const unknown = ['v1', '9', ...envelope.split('.').slice(2)].join('.');
    expect(() => cipher.decrypt(unknown, AAD)).toThrow(TokenDecryptionError);
    expect(() => cipher.decrypt('garbage', AAD)).toThrow(TokenDecryptionError);
    expect(() => cipher.decrypt(envelope.replace('v1', 'v2'), AAD)).toThrow(TokenDecryptionError);
  });

  it('never leaks plaintext, key or ciphertext in error messages', () => {
    const aesKey = key();
    const cipher = cipherWith(1, { 1: aesKey });
    const plaintext = 'super-secret-plaintext';
    const envelope = cipher.encrypt(plaintext, AAD);
    let message = '';
    try {
      cipher.decrypt(tamper(envelope, 4), AAD);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    for (const secret of [plaintext, aesKey.toString('base64'), ...envelope.split('.').slice(2)]) {
      expect(message).not.toContain(secret);
    }
  });

  it('rejects keys that are not 32 bytes or a current version without a key', () => {
    expect(() => cipherWith(1, { 1: randomBytes(16) })).toThrow(/32 bytes/);
    expect(() => cipherWith(2, { 1: key() })).toThrow(/current key version/);
  });

  it('fails on use when encryption is not configured', () => {
    const cipher = new TokenCipher(null);
    expect(() => cipher.encrypt('x', AAD)).toThrow(/not configured/);
    expect(() => cipher.decrypt('v1.1.a.b.c', AAD)).toThrow(/not configured/);
  });
});
