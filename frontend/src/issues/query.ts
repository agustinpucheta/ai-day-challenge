export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

/** Same normalization the backend applies: surrounding whitespace is not part of the query. */
export function normalizeQuery(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Client-side mirror of the backend rule (2-100 characters, no control characters). */
export function validateQuery(raw: unknown): string | null {
  const query = normalizeQuery(raw);
  if (query.length < MIN_QUERY_LENGTH) {
    return `Enter at least ${MIN_QUERY_LENGTH} characters to search.`;
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return `Use at most ${MAX_QUERY_LENGTH} characters.`;
  }
  if (/[\u0000-\u001f\u007f]/.test(query)) {
    return 'The search cannot contain control characters.';
  }
  return null;
}
