import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IssueKeyParamDto, SearchIssuesQueryDto } from './search-issues-query.dto';

async function queryErrors(payload: Record<string, unknown>) {
  const dto = plainToInstance(SearchIssuesQueryDto, payload);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe('SearchIssuesQueryDto', () => {
  it('accepts a text query with defaults and trims it', async () => {
    const { dto, fields } = await queryErrors({ q: '  login bug  ' });
    expect(fields).toEqual([]);
    expect(dto.q).toBe('login bug');
    expect(dto.pageSize).toBeUndefined();
  });

  it('accepts an issue key, a page token and a numeric page size string', async () => {
    const { dto, fields } = await queryErrors({
      q: 'MASIN-1',
      pageToken: 'opaque-token_2=',
      pageSize: '50',
    });
    expect(fields).toEqual([]);
    expect(dto.pageSize).toBe(50);
  });

  it.each([
    ['missing', undefined],
    ['too short after trim', ' a '],
    ['empty', ''],
    ['too long', 'x'.repeat(101)],
    ['with a control character', 'a\u0000b'],
    ['with a newline inside', 'foo\nbar'],
    ['not a string', ['a', 'b']],
  ])('rejects q that is %s', async (_label, q) => {
    expect((await queryErrors({ q })).fields).toEqual(['q']);
  });

  it('accepts a query of exactly 2 and 100 characters', async () => {
    expect((await queryErrors({ q: 'ab' })).fields).toEqual([]);
    expect((await queryErrors({ q: 'x'.repeat(100) })).fields).toEqual([]);
  });

  it.each([
    ['too long', 'a'.repeat(2001)],
    ['with spaces', 'a b'],
    ['with a quote', 'a"b'],
    ['with a slash-less unsafe char', 'a<b>'],
    ['empty', ''],
  ])('rejects a page token that is %s', async (_label, pageToken) => {
    expect((await queryErrors({ q: 'abc', pageToken })).fields).toEqual(['pageToken']);
  });

  it('accepts a page token of exactly 2000 characters', async () => {
    expect((await queryErrors({ q: 'abc', pageToken: 'a'.repeat(2000) })).fields).toEqual([]);
  });

  it.each(['0', '51', '-1', '1.5', 'abc', ''])('rejects pageSize %p', async (pageSize) => {
    expect((await queryErrors({ q: 'abc', pageSize })).fields).toEqual(['pageSize']);
  });

  it('rejects fields outside the whitelist, including userId', async () => {
    expect((await queryErrors({ q: 'abc', userId: 'x' })).fields).toEqual(['userId']);
  });
});

describe('IssueKeyParamDto', () => {
  const fieldsFor = async (issueKey: unknown) =>
    (await validate(plainToInstance(IssueKeyParamDto, { issueKey }))).map((e) => e.property);

  it.each(['MASIN-1', 'masin-13434', 'AB_C1-99'])('accepts %s', async (key) => {
    expect(await fieldsFor(key)).toEqual([]);
  });

  it.each([
    '',
    '1-2',
    'MASIN',
    'MASIN-',
    'MASIN-1a',
    'MASIN 1',
    '../etc',
    'A-1',
    `M${'X'.repeat(60)}-1`,
  ])('rejects %p', async (key) => {
    expect(await fieldsFor(key)).toEqual(['issueKey']);
  });
});
