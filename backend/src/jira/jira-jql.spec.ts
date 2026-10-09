import { JiraInvalidQueryError } from './errors';
import { MAX_QUERY_LENGTH, buildChildrenJql, buildSearchJql } from './jira-jql';

describe('buildChildrenJql', () => {
  it('builds a parent clause with a stable order and an upper-cased key', () => {
    expect(buildChildrenJql('demo-1')).toBe('parent = "DEMO-1" ORDER BY key ASC');
  });

  it.each([['DEMO-1" OR 1=1 --'], ['DEMO-1\n'], ['hello'], [''], ['DEMO-']])(
    'rejects the invalid key %p without building a query',
    (key) => {
      expect(() => buildChildrenJql(key)).toThrow(JiraInvalidQueryError);
    },
  );
});

const LS = String.fromCharCode(0x2028);
const ORDER = ' ORDER BY updated DESC';

/** Extracts the quoted text of `text ~ "<...>"`, honoring backslash escapes, or null if broken. */
function quotedText(jql: string): string | null {
  const match = /^text ~ "((?:[^"\\]|\\.)*)"(.*)$/.exec(jql);
  return match && match[2] === ORDER ? (match[1] ?? null) : null;
}

describe('buildSearchJql', () => {
  it.each([
    ['masin-123', 'key = "MASIN-123"'],
    ['  DEMO-1  ', 'key = "DEMO-1"'],
    ['Ab_c-9', 'key = "AB_C-9"'],
  ])('turns the issue key %p into an exact key clause', (input, clause) => {
    expect(buildSearchJql(input)).toBe(`${clause}${ORDER}`);
  });

  it('builds a quoted text search for free text', () => {
    expect(buildSearchJql('login error')).toBe(`text ~ "login error"${ORDER}`);
  });

  it.each([
    ['" OR project = X', '\\" OR project = X'],
    ['\\" OR 1=1', '\\\\\\" OR 1=1'],
    ['back\\slash', 'back\\\\slash'],
    ['a" AND assignee = currentUser() OR "b', 'a\\" AND assignee = currentUser() OR \\"b'],
    ['line1\nline2\r\nline3', 'line1 line2 line3'],
    ['tab\there\u0000nul', 'tab here nul'],
    ['ORDER BY created ASC', 'ORDER BY created ASC'],
    ['DEMO-1 OR key = DEMO-2', 'DEMO-1 OR key = DEMO-2'],
    ['"', '\\"'],
    ['\\', '\\\\'],
  ])('keeps the injection attempt %p inside the quoted string', (input, escaped) => {
    const jql = buildSearchJql(input);
    expect(jql).toBe(`text ~ "${escaped}"${ORDER}`);
    expect(quotedText(jql)).toBe(escaped);
  });

  it('never lets an unescaped quote out of the string for adversarial characters', () => {
    const alphabet = ['"', '\\', ' ', 'a', '\n', '=', '(', ')', "'", LS];
    let state = 7;
    for (let i = 0; i < 300; i++) {
      let input = 'x';
      for (let j = 0; j < 12; j++) {
        state = (state * 1103515245 + 12345) % 2147483648;
        input += alphabet[state % alphabet.length];
      }
      let jql: string;
      try {
        jql = buildSearchJql(input);
      } catch (error) {
        expect(error).toBeInstanceOf(JiraInvalidQueryError);
        continue;
      }
      expect(quotedText(jql)).not.toBeNull();
    }
  });

  it.each([[''], ['   '], ['\n\t\u0000'], ['x'.repeat(MAX_QUERY_LENGTH + 1)]])(
    'rejects %p without building JQL',
    (input) => {
      expect(() => buildSearchJql(input)).toThrow(JiraInvalidQueryError);
    },
  );

  it('accepts text of exactly the maximum length', () => {
    expect(() => buildSearchJql('x'.repeat(MAX_QUERY_LENGTH))).not.toThrow();
  });

  it('restricts by issue type ids when provided', () => {
    expect(buildSearchJql('login', { issueTypeIds: ['10001', '10002'] })).toBe(
      `text ~ "login" AND issuetype in (10001, 10002)${ORDER}`,
    );
    expect(buildSearchJql('DEMO-1', { issueTypeIds: ['10001'] })).toBe(
      `key = "DEMO-1" AND issuetype in (10001)${ORDER}`,
    );
    expect(buildSearchJql('login', { issueTypeIds: [] })).toBe(`text ~ "login"${ORDER}`);
  });

  it.each([['Story'], ['1) OR (1'], ['10001"'], ['']])(
    'rejects the non-numeric issue type %p',
    (id) => {
      expect(() => buildSearchJql('login', { issueTypeIds: [id] })).toThrow(JiraInvalidQueryError);
    },
  );
});
