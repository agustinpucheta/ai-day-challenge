const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginCheckInput {
  method: string;
  origin?: string;
  referer?: string;
}

function originFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defense for cookie-authenticated requests: state-changing methods must come
 * from an allowed origin (Origin header, or Referer as a fallback): the web app and,
 * when Swagger is enabled, the API itself.
 * Requests that carry neither header are rejected (fail closed).
 */
export function isRequestOriginAllowed(
  input: OriginCheckInput,
  allowedOrigins: readonly string[],
): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) {
    return true;
  }
  let requestOrigin: string | null = null;
  if (input.origin) {
    requestOrigin = input.origin;
  } else if (input.referer) {
    requestOrigin = originFromReferer(input.referer);
  }
  return (
    requestOrigin !== null && requestOrigin !== 'null' && allowedOrigins.includes(requestOrigin)
  );
}
