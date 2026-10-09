const FALLBACK = '/';
const INTERNAL_BASE = 'http://internal.invalid';
/** Pages that make no sense as a post-login destination (avoids redirect loops). */
const GUEST_PATHS = new Set(['/login', '/register']);

/**
 * Returns `value` only when it is a same-app path, otherwise `/`. Prevents open redirects via
 * `?redirect=` (absolute URLs, protocol-relative `//host`, backslash tricks, schemes).
 */
export function sanitizeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return FALLBACK;
  }
  // Browsers treat "\" like "/" and silently drop control characters, so reject them outright.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) {
    return FALLBACK;
  }
  let url: URL;
  try {
    url = new URL(value, INTERNAL_BASE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== INTERNAL_BASE || GUEST_PATHS.has(url.pathname)) {
    return FALLBACK;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
