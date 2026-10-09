import { inspect } from 'node:util';
import { Secret } from './secret';

describe('Secret', () => {
  const RAW = 'api-token-value-123';
  const secret = new Secret(RAW);

  it('reveals the value only through reveal()', () => {
    expect(secret.reveal()).toBe(RAW);
  });

  it('never prints the value when stringified, serialized or inspected', () => {
    const holder = { token: secret, other: 'ok' };
    const rendered = [
      String(secret),
      JSON.stringify(holder),
      inspect(holder, { depth: 5 }),
      JSON.stringify({ ...holder }),
    ].join('\n');
    expect(rendered).not.toContain(RAW);
    expect(rendered).toContain('[REDACTED]');
  });
});
