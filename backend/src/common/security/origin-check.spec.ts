import { isRequestOriginAllowed } from './origin-check';

const WEB = 'http://localhost:5173';
const ALLOWED = [WEB];

describe('isRequestOriginAllowed', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('allows safe method %s without an origin', (method) => {
    expect(isRequestOriginAllowed({ method }, ALLOWED)).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows %s from the configured origin', (method) => {
    expect(isRequestOriginAllowed({ method, origin: WEB }, ALLOWED)).toBe(true);
  });

  it('rejects a state-changing request from a foreign origin', () => {
    expect(
      isRequestOriginAllowed({ method: 'POST', origin: 'https://evil.example' }, ALLOWED),
    ).toBe(false);
  });

  it('rejects a state-changing request with neither Origin nor Referer', () => {
    expect(isRequestOriginAllowed({ method: 'POST' }, ALLOWED)).toBe(false);
  });

  it('rejects the opaque "null" origin', () => {
    expect(isRequestOriginAllowed({ method: 'POST', origin: 'null' }, ALLOWED)).toBe(false);
  });

  it('falls back to the Referer origin when Origin is missing', () => {
    expect(
      isRequestOriginAllowed(
        { method: 'PATCH', referer: 'http://localhost:5173/settings?x=1' },
        ALLOWED,
      ),
    ).toBe(true);
    expect(
      isRequestOriginAllowed(
        { method: 'PATCH', referer: 'http://localhost:5173.evil.example/' },
        ALLOWED,
      ),
    ).toBe(false);
  });

  it('rejects an unparseable Referer', () => {
    expect(isRequestOriginAllowed({ method: 'DELETE', referer: 'not a url' }, ALLOWED)).toBe(false);
  });

  it('does not accept a different port or scheme', () => {
    expect(
      isRequestOriginAllowed({ method: 'POST', origin: 'http://localhost:5174' }, ALLOWED),
    ).toBe(false);
    expect(
      isRequestOriginAllowed({ method: 'POST', origin: 'https://localhost:5173' }, ALLOWED),
    ).toBe(false);
  });

  it('allows the API own origin only when it is in the allowlist', () => {
    const api = 'http://localhost:3000';
    expect(isRequestOriginAllowed({ method: 'POST', origin: api }, [WEB, api])).toBe(true);
    expect(isRequestOriginAllowed({ method: 'POST', origin: api }, [WEB])).toBe(false);
    expect(
      isRequestOriginAllowed({ method: 'POST', origin: 'https://evil.example' }, [WEB, api]),
    ).toBe(false);
    expect(isRequestOriginAllowed({ method: 'POST' }, [WEB, api])).toBe(false);
  });
});
