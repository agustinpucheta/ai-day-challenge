import { JiraInvalidQueryError } from './errors';

export const ISSUE_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]+-\d+$/;
export const MAX_QUERY_LENGTH = 100;

export interface BuildJqlOptions {
  /** Issue type ids (digits only). Ids, never names: names are localized and fail silently. */
  issueTypeIds?: readonly string[];
}

const CONTROL_RANGES: Array<[number, number]> = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x2028, 0x2029],
];
const CONTROL_CHARS = new RegExp(
  `[${CONTROL_RANGES.map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join('')}]+`,
  'g',
);

/** True when the text contains control or line-separator characters. */
export function containsControlChars(input: string): boolean {
  return input.search(CONTROL_CHARS) !== -1;
}

/**
 * Builds the JQL for a user-typed query. The input is never concatenated raw: an issue key
 * becomes `key = "KEY"`, anything else becomes a quoted text search with backslash and double
 * quote escaped and control characters removed.
 */
export function buildSearchJql(input: string, options: BuildJqlOptions = {}): string {
  const trimmed = input.trim();
  const clauses = [ISSUE_KEY_PATTERN.test(trimmed) ? keyClause(trimmed) : textClause(trimmed)];
  if (options.issueTypeIds !== undefined && options.issueTypeIds.length > 0) {
    clauses.push(`issuetype in (${options.issueTypeIds.map(typeId).join(', ')})`);
  }
  return `${clauses.join(' AND ')} ORDER BY updated DESC`;
}

/**
 * JQL for the direct children of an issue (`parent = "KEY"`). The key is validated against the
 * key pattern first and never concatenated raw; the order is stable so token paging is safe.
 */
export function buildChildrenJql(parentKey: string): string {
  if (!ISSUE_KEY_PATTERN.test(parentKey)) throw new JiraInvalidQueryError();
  return `parent = "${parentKey.toUpperCase()}" ORDER BY key ASC`;
}

function keyClause(key: string): string {
  return `key = "${key.toUpperCase()}"`;
}

function textClause(input: string): string {
  const cleaned = input.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned === '' || cleaned.length > MAX_QUERY_LENGTH) throw new JiraInvalidQueryError();
  const escaped = cleaned.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `text ~ "${escaped}"`;
}

function typeId(id: string): string {
  if (!/^\d{1,18}$/.test(id)) throw new JiraInvalidQueryError();
  return id;
}
