import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  AddTrackedIssueDto,
  ListTrackedIssuesQueryDto,
  TrackedIssueIdParamDto,
} from './tracked-issue-requests.dto';

const check = <T extends object>(cls: new () => T, plain: object) => {
  const instance = plainToInstance(cls, plain);
  return { instance, errors: validateSync(instance, { whitelist: true }) };
};

describe('AddTrackedIssueDto', () => {
  it.each([
    ['demo-12', 'DEMO-12'],
    ['  masin-13434 ', 'MASIN-13434'],
    ['AB_C-1', 'AB_C-1'],
  ])('uppercases and trims %p to %p', (input, expected) => {
    const { instance, errors } = check(AddTrackedIssueDto, { issueKey: input });
    expect(errors).toEqual([]);
    expect(instance.issueKey).toBe(expected);
  });

  it.each(['', 'hello', 'DEMO-', 'A-1', '../admin', 'DEMO-1 OR 1=1', `${'A'.repeat(70)}-1`, 12])(
    'rejects %p',
    (input) => {
      expect(check(AddTrackedIssueDto, { issueKey: input }).errors).not.toEqual([]);
    },
  );
});

describe('TrackedIssueIdParamDto', () => {
  it('accepts a uuid and rejects anything else', () => {
    expect(
      check(TrackedIssueIdParamDto, { id: '4b0f6f3e-9a2c-4d55-8f1e-2c6a7b9d1e30' }).errors,
    ).toEqual([]);
    expect(check(TrackedIssueIdParamDto, { id: 'not-a-uuid' }).errors).not.toEqual([]);
  });
});

describe('ListTrackedIssuesQueryDto', () => {
  it('parses refresh=true/false and rejects other values', () => {
    expect(check(ListTrackedIssuesQueryDto, { refresh: 'true' }).instance.refresh).toBe(true);
    expect(check(ListTrackedIssuesQueryDto, { refresh: 'false' }).instance.refresh).toBe(false);
    expect(check(ListTrackedIssuesQueryDto, {}).errors).toEqual([]);
    expect(check(ListTrackedIssuesQueryDto, { refresh: 'yes' }).errors).not.toEqual([]);
  });
});
