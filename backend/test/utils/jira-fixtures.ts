import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads a sanitized REST v3 fixture from `test/fixtures/jira` (without the `.json` suffix). */
export function jiraFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'jira', `${name}.json`), 'utf8'),
  );
}
