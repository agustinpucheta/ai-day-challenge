import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE_VERSION = 'v1';

/** Raised for any decryption failure. Its message never carries plaintext, keys or ciphertext. */
export class TokenDecryptionError extends Error {
  constructor() {
    super('Token could not be decrypted');
    this.name = 'TokenDecryptionError';
  }
}

export interface TokenKeyring {
  /** Version used for new encryptions; must exist in `keys`. */
  currentVersion: number;
  /** Key material by version; older versions are kept only to decrypt. */
  keys: Record<number, Buffer>;
}

/**
 * AES-256-GCM with a random 12-byte IV per call. Envelope (base64url segments):
 * `v1.<keyVersion>.<iv>.<tag>.<ciphertext>`. The AAD (for example the connection id)
 * is authenticated but not stored, so a ciphertext copied to another row fails to decrypt.
 */
export class TokenCipher {
  constructor(private readonly keyring: TokenKeyring | null) {
    if (keyring === null) return;
    for (const key of Object.values(keyring.keys)) {
      if (key.length !== KEY_BYTES) throw new Error(`Encryption keys must be ${KEY_BYTES} bytes`);
    }
    if (!(keyring.currentVersion in keyring.keys)) {
      throw new Error('The current key version has no key');
    }
  }

  get currentVersion(): number {
    return this.requireKeyring().currentVersion;
  }

  encrypt(plaintext: string, aad: string): string {
    const { currentVersion, keys } = this.requireKeyring();
    const iv = randomBytes(IV_BYTES);
    const key = keys[currentVersion];
    if (!key) throw new Error('The current key version has no key');
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [
      ENVELOPE_VERSION,
      String(currentVersion),
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string, aad: string): string {
    const { keys } = this.requireKeyring();
    try {
      const [version, keyVersion, ivPart, tagPart, dataPart, ...extra] = envelope.split('.');
      if (
        version !== ENVELOPE_VERSION ||
        extra.length > 0 ||
        !/^[1-9]\d*$/.test(keyVersion ?? '')
      ) {
        throw new TokenDecryptionError();
      }
      const key = keys[Number(keyVersion)];
      const iv = Buffer.from(ivPart ?? '', 'base64url');
      const tag = Buffer.from(tagPart ?? '', 'base64url');
      if (!key || iv.length !== IV_BYTES || tag.length !== TAG_BYTES || dataPart === undefined) {
        throw new TokenDecryptionError();
      }
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(tag);
      const data = Buffer.from(dataPart, 'base64url');
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      // Deliberately drop the underlying error: it could describe key or ciphertext details.
      throw new TokenDecryptionError();
    }
  }

  private requireKeyring(): TokenKeyring {
    if (this.keyring === null) throw new Error('Token encryption is not configured');
    return this.keyring;
  }
}
