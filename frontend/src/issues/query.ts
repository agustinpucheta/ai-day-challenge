import { es } from '@/i18n/es';

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
    return es.search.minLength(MIN_QUERY_LENGTH);
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return es.search.maxLength(MAX_QUERY_LENGTH);
  }
  if (/[\u0000-\u001f\u007f]/.test(query)) {
    return es.search.controlChars;
  }
  return null;
}
