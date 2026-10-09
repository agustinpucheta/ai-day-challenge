import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Secret } from '../src/config/secret';
import { ApiTokenCredentialProvider } from '../src/jira/credentials/api-token-credential-provider';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
  type JiraRequestAuth,
} from '../src/jira/credentials/jira-credential-provider';
import { JiraNotConfiguredError } from '../src/jira/errors';
import { HTTP_PORT, type HttpPort, type HttpResult } from '../src/jira/oauth/http-port';
import { TRACKING_CONFIG, TRACKING_OPTIONS } from '../src/tracking/tracking.config';
import { jiraFixture } from './utils/jira-fixtures';
import { API, TestContext, createTestApp, registerAndLogin } from './utils/test-app';

const SITE = 'https://acme.atlassian.net';
const EMAIL = 'owner@example.com';
const TOKEN = 'ATATT-e2e-tracking-secret-token';
const BASIC = Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const SECRETS = [TOKEN, EMAIL, BASIC];
const URL_BASE = `${API}/users/me/tracked-issues`;
const EVIL = 'https://evil.example';

const ok = (body: unknown): HttpResult => ({ status: 200, headers: {}, body });
const failed = (status: number): HttpResult => ({
  status,
  headers: {},
  body: { errorMessages: [`remote detail with ${TOKEN} and ${EMAIL}`] },
});

const issueKeyOf = (url: string): string => /\/issue\/([A-Za-z0-9_-]+)\?/.exec(url)?.[1] ?? '';

/** Jira double behind the HttpPort, answering GET per issue key. Never touches the network. */
class FakeJiraHttp implements HttpPort {
  readonly gets: string[] = [];
  readonly posts: Array<Record<string, unknown>> = [];
  issues = new Map<string, HttpResult | Error>();
  onPost: (body: Record<string, unknown>) => HttpResult = () => ok(jiraFixture('search-empty'));

  getsFor(key: string): number {
    return this.gets.filter((url) => issueKeyOf(url) === key).length;
  }

  postJson(_url: string, body: unknown): Promise<HttpResult> {
    const typed = body as Record<string, unknown>;
    this.posts.push(typed);
    return Promise.resolve(this.onPost(typed));
  }

  getJson(url: string): Promise<HttpResult> {
    this.gets.push(url);
    const result = this.issues.get(issueKeyOf(url)) ?? failed(404);
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  }
}

/** Switchable provider so a test can unconfigure Jira after tracking issues. */
class SwitchableProvider implements JiraCredentialProvider {
  configured = true;
  private readonly real = new ApiTokenCredentialProvider({
    url: SITE,
    username: EMAIL,
    token: new Secret(TOKEN),
  });

  resolve(userId: string): Promise<JiraRequestAuth> {
    return this.configured
      ? this.real.resolve(userId)
      : Promise.reject(new JiraNotConfiguredError());
  }
}

interface ListItem {
  id: string;
  issueKey: string;
  status: string;
}

const itemsOf = (res: request.Response): ListItem[] => (res.body as { items: ListItem[] }).items;

function expectNoSecrets(res: request.Response): void {
  const text = JSON.stringify(res.body) + res.text + JSON.stringify(res.headers);
  for (const secret of SECRETS) expect(text).not.toContain(secret);
  expect(text.toLowerCase()).not.toContain('authorization');
  expect(text).not.toContain('@example.com');
}

describe('Tracked issues (e2e)', () => {
  let ctx: TestContext;
  let jira: FakeJiraHttp;
  let provider: SwitchableProvider;
  let agent: TestAgent;

  async function start(options = TRACKING_CONFIG): Promise<void> {
    jira = new FakeJiraHttp();
    jira.issues.set('DEMO-1', ok(jiraFixture('epic')));
    jira.issues.set('DEMO-2', ok(jiraFixture('story-with-subtasks')));
    jira.issues.set('DEMO-8', ok(jiraFixture('task-no-subtasks')));
    jira.onPost = (body) =>
      body.nextPageToken === undefined
        ? ok(jiraFixture('children-page-1'))
        : ok(jiraFixture('children-last-page'));
    provider = new SwitchableProvider();
    ctx = await createTestApp((builder) =>
      builder
        .overrideProvider(JIRA_CREDENTIAL_PROVIDER)
        .useValue(provider)
        .overrideProvider(HTTP_PORT)
        .useValue(jira)
        .overrideProvider(TRACKING_OPTIONS)
        .useValue(options),
    );
    agent = await registerAndLogin(ctx, 'tracker-a@example.com');
  }

  const track = (who: TestAgent, issueKey: string) => who.post(URL_BASE).send({ issueKey });

  afterEach(async () => {
    await ctx.close();
  });

  describe('authentication and CSRF', () => {
    it('requires a session on all three endpoints', async () => {
      await start();
      const anonymous = ctx.agent();
      const id = '4b0f6f3e-9a2c-4d55-8f1e-2c6a7b9d1e30';
      for (const res of [
        await anonymous.post(URL_BASE).send({ issueKey: 'DEMO-2' }).expect(401),
        await anonymous.get(URL_BASE).expect(401),
        await anonymous.delete(`${URL_BASE}/${id}`).expect(401),
      ]) {
        expect(res.body.code).toBe('UNAUTHENTICATED');
      }
      expect(jira.gets).toHaveLength(0);
    });

    it('rejects a foreign Origin on POST and DELETE', async () => {
      await start();
      const created = await track(agent, 'DEMO-2').expect(201);
      const post = await agent.post(URL_BASE).set('Origin', EVIL).send({ issueKey: 'DEMO-8' });
      const del = await agent
        .delete(`${URL_BASE}/${created.body.id as string}`)
        .set('Origin', EVIL);
      expect(post.status).toBe(403);
      expect(del.status).toBe(403);
      expect(post.body.code).toBe('FORBIDDEN_ORIGIN');
      expect(await ctx.prisma.trackedIssue.count()).toBe(1);
    });
  });

  describe('POST /users/me/tracked-issues', () => {
    it('creates (201), then answers 200 with the same entry and no duplicate row', async () => {
      await start();
      const first = await track(agent, ' demo-2 ').expect(201);
      expect(first.body).toEqual({
        id: expect.any(String),
        issueKey: 'DEMO-2',
        addedAt: expect.any(String),
      });
      const again = await track(agent, 'DEMO-2').expect(200);
      expect(again.body).toEqual(first.body);
      expect(await ctx.prisma.trackedIssue.count()).toBe(1);
      const row = await ctx.prisma.trackedIssue.findFirstOrThrow();
      expect(row).toMatchObject({ issueKey: 'DEMO-2', jiraSiteUrl: SITE, displayOrder: 1 });
      expect(jira.gets[0]).toContain(`${SITE}/rest/api/3/issue/DEMO-2?fields=`);
      const audit = await ctx.prisma.auditEvent.findMany({
        where: { eventType: 'tracked_issue_added' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ targetIssueKey: 'DEMO-2', success: true });
      expectNoSecrets(first);
    });

    it('stays a single row under concurrent adds of the same key', async () => {
      await start();
      const results = await Promise.all([1, 2, 3, 4].map(() => track(agent, 'DEMO-2')));
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 201]);
      expect(new Set(results.map((r) => r.body.id as string)).size).toBe(1);
      expect(await ctx.prisma.trackedIssue.count()).toBe(1);
    });

    it('answers the same 404 for a missing and a forbidden issue and inserts nothing', async () => {
      await start();
      jira.issues.set('DEMO-404', failed(404));
      jira.issues.set('DEMO-403', failed(403));
      const missing = await track(agent, 'DEMO-404').expect(404);
      const forbidden = await track(agent, 'DEMO-403').expect(404);
      expect(missing.body).toEqual({
        code: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE',
        message: 'The issue does not exist or is not accessible',
      });
      expect(forbidden.text).toBe(missing.text);
      expect(await ctx.prisma.trackedIssue.count()).toBe(0);
    });

    it.each([
      ['a 401', failed(401), 424, 'JIRA_REAUTH_REQUIRED'],
      ['a 429', failed(429), 429, 'JIRA_RATE_LIMITED'],
      ['a 500', failed(500), 503, 'JIRA_UNAVAILABLE'],
      ['a network error', new Error(`ECONNRESET ${TOKEN}`), 503, 'JIRA_UNAVAILABLE'],
    ])('maps %s from Jira and inserts nothing', async (_label, result, status, code) => {
      await start();
      jira.issues.set('DEMO-2', result);
      const res = await track(agent, 'DEMO-2').expect(status);
      expect(res.body.code).toBe(code);
      expect(await ctx.prisma.trackedIssue.count()).toBe(0);
      expectNoSecrets(res);
    });

    it('answers JIRA_NOT_CONNECTED (409) when Jira is not configured', async () => {
      await start();
      provider.configured = false;
      const res = await track(agent, 'DEMO-2').expect(409);
      expect(res.body.code).toBe('JIRA_NOT_CONNECTED');
      expect(jira.gets).toHaveLength(0);
      expect(await ctx.prisma.trackedIssue.count()).toBe(0);
    });

    it.each([
      ['not a key', { issueKey: 'hello' }],
      ['missing key', {}],
      ['a path-like key', { issueKey: '../admin' }],
      ['a client userId', { issueKey: 'DEMO-2', userId: 'someone-else' }],
    ])('answers 400 VALIDATION_ERROR without calling Jira on %s', async (_label, body) => {
      await start();
      const res = await agent.post(URL_BASE).send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(jira.gets).toHaveLength(0);
    });

    it('answers 409 TRACKING_LIMIT_REACHED past the cap but still replays a tracked key', async () => {
      await start({ ...TRACKING_CONFIG, maxPerUser: 2 });
      await track(agent, 'DEMO-1').expect(201);
      await track(agent, 'DEMO-2').expect(201);
      const over = await track(agent, 'DEMO-8').expect(409);
      expect(over.body.code).toBe('TRACKING_LIMIT_REACHED');
      await track(agent, 'DEMO-2').expect(200);
      expect(await ctx.prisma.trackedIssue.count()).toBe(2);
      // The cap is per user.
      const other = await registerAndLogin(ctx, 'tracker-b@example.com');
      await track(other, 'DEMO-8').expect(201);
    });
  });

  describe('GET /users/me/tracked-issues', () => {
    it('returns progress for a story (by subtasks) and an epic (by children), in order', async () => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      await track(agent, 'DEMO-1').expect(201);
      const res = await agent.get(URL_BASE).expect(200);
      expect(res.body.metadata).toEqual({ fetchedAt: expect.any(String) });
      expect(itemsOf(res).map((i) => i.issueKey)).toEqual(['DEMO-2', 'DEMO-1']);
      const [story, epic] = itemsOf(res);
      expect(story).toMatchObject({
        status: 'ok',
        issue: {
          key: 'DEMO-2',
          summary: 'Story with subtasks',
          url: `${SITE}/browse/DEMO-2`,
          storyPoints: { final: 8, planned: 13 },
        },
        progress: { basis: 'subtasks', state: 'ok', total: 2, completed: 1, percent: 50 },
        fetchedAt: expect.any(String),
      });
      expect(story).not.toHaveProperty('childrenCount');
      expect(story).not.toHaveProperty('error');
      expect(epic).toMatchObject({
        status: 'ok',
        childrenCount: 3,
        progress: { basis: 'children', state: 'ok', total: 2, isApproximate: false },
      });
      expectNoSecrets(res);
    });

    it('returns an empty list with 200 when nothing is tracked', async () => {
      await start();
      const res = await agent.get(URL_BASE).expect(200);
      expect(res.body.items).toEqual([]);
    });

    it('turns one failing item into an error entry while the others stay ok (200)', async () => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      await track(agent, 'DEMO-8').expect(201);
      await track(agent, 'DEMO-1').expect(201);
      jira.issues.set('DEMO-8', failed(404));
      const res = await agent.get(URL_BASE).expect(200);
      const byKey = Object.fromEntries(itemsOf(res).map((i) => [i.issueKey, i]));
      expect(byKey['DEMO-2']?.status).toBe('ok');
      expect(byKey['DEMO-1']?.status).toBe('ok');
      expect(byKey['DEMO-8']).toEqual({
        id: expect.any(String),
        issueKey: 'DEMO-8',
        addedAt: expect.any(String),
        status: 'error',
        fetchedAt: expect.any(String),
        error: {
          code: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE',
          message: 'The issue does not exist or is not accessible',
        },
      });
      for (const field of ['progress', 'issue', 'childrenCount', 'warnings']) {
        expect(byKey['DEMO-8']).not.toHaveProperty(field);
      }
      expectNoSecrets(res);
    });

    it.each([
      ['a 401', failed(401), 'JIRA_REAUTH_REQUIRED'],
      ['a 429', failed(429), 'JIRA_RATE_LIMITED'],
      ['a 500', failed(500), 'JIRA_UNAVAILABLE'],
      ['a network error', new Error(`ECONNRESET ${TOKEN}`), 'JIRA_UNAVAILABLE'],
    ])('reports %s as a per-item error with the Jira code', async (_label, result, code) => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      await track(agent, 'DEMO-8').expect(201);
      jira.issues.set('DEMO-2', result);
      jira.issues.set('DEMO-8', result);
      const res = await agent.get(URL_BASE).expect(200);
      for (const item of res.body.items) {
        expect(item).toMatchObject({ status: 'error', error: { code } });
        expect(item).not.toHaveProperty('progress');
      }
      expectNoSecrets(res);
    });

    it('reports a failing epic children read as an item error, never partial progress', async () => {
      await start();
      await track(agent, 'DEMO-1').expect(201);
      jira.onPost = () => failed(500);
      const res = await agent.get(URL_BASE).expect(200);
      expect(res.body.items[0]).toMatchObject({
        status: 'error',
        error: { code: 'JIRA_UNAVAILABLE' },
      });
      expect(res.body.items[0]).not.toHaveProperty('progress');
    });

    it('lists every entry as JIRA_NOT_CONNECTED without calling Jira when unconfigured', async () => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      jira.gets.length = 0;
      provider.configured = false;
      const res = await agent.get(URL_BASE).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        status: 'error',
        error: { code: 'JIRA_NOT_CONNECTED' },
      });
      expect(jira.gets).toHaveLength(0);
    });

    it('caches within the TTL (original fetchedAt) and bypasses it with refresh=true', async () => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      jira.gets.length = 0;
      const first = await agent.get(URL_BASE).expect(200);
      const second = await agent.get(URL_BASE).expect(200);
      expect(jira.getsFor('DEMO-2')).toBe(1);
      expect(second.body.items[0].fetchedAt).toBe(first.body.items[0].fetchedAt);
      const refreshed = await agent.get(`${URL_BASE}?refresh=true`).expect(200);
      expect(jira.getsFor('DEMO-2')).toBe(2);
      expect(refreshed.body.items[0].fetchedAt >= first.body.items[0].fetchedAt).toBe(true);
      await agent.get(`${URL_BASE}?refresh=maybe`).expect(400);
    });

    it('does not cache a failure: the next list retries Jira', async () => {
      await start();
      await track(agent, 'DEMO-2').expect(201);
      jira.gets.length = 0;
      jira.issues.set('DEMO-2', failed(500));
      const down = await agent.get(URL_BASE).expect(200);
      expect(down.body.items[0].status).toBe('error');
      jira.issues.set('DEMO-2', ok(jiraFixture('story-with-subtasks')));
      const up = await agent.get(URL_BASE).expect(200);
      expect(up.body.items[0].status).toBe('ok');
      expect(jira.getsFor('DEMO-2')).toBe(2);
    });
  });

  describe('DELETE /users/me/tracked-issues/:id', () => {
    it('removes the entry with 204 and stays idempotent (also for an unknown id)', async () => {
      await start();
      const created = await track(agent, 'DEMO-2').expect(201);
      await agent.delete(`${URL_BASE}/${created.body.id as string}`).expect(204);
      await agent.delete(`${URL_BASE}/${created.body.id as string}`).expect(204);
      await agent.delete(`${URL_BASE}/4b0f6f3e-9a2c-4d55-8f1e-2c6a7b9d1e30`).expect(204);
      expect(await ctx.prisma.trackedIssue.count()).toBe(0);
      const audit = await ctx.prisma.auditEvent.findMany({
        where: { eventType: 'tracked_issue_removed' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ targetIssueKey: 'DEMO-2' });
      expect((await agent.get(URL_BASE).expect(200)).body.items).toEqual([]);
    });

    it('answers 400 VALIDATION_ERROR for a non-uuid id', async () => {
      await start();
      const res = await agent.delete(`${URL_BASE}/not-a-uuid`).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('user isolation', () => {
    it('keeps lists, deletes and the cache separate per user', async () => {
      await start();
      const userB = await registerAndLogin(ctx, 'tracker-b@example.com');
      const aEntry = await track(agent, 'DEMO-2').expect(201);
      await track(agent, 'DEMO-1').expect(201);
      // The same key is tracked by both users independently.
      const bEntry = await track(userB, 'DEMO-2').expect(201);
      expect(bEntry.body.id).not.toBe(aEntry.body.id);
      expect(await ctx.prisma.trackedIssue.count()).toBe(3);

      // Different lists: B sees only its own key.
      const aList = await agent.get(URL_BASE).expect(200);
      const bList = await userB.get(URL_BASE).expect(200);
      expect(aList.body.items).toHaveLength(2);
      expect(itemsOf(bList).map((i) => i.issueKey)).toEqual(['DEMO-2']);
      expect(JSON.stringify(bList.body)).not.toContain('DEMO-1');

      // A's cached result is never served to B: each user triggered its own Jira read.
      expect(jira.getsFor('DEMO-2')).toBe(2 + 2);
      jira.gets.length = 0;
      await agent.get(URL_BASE).expect(200);
      await userB.get(URL_BASE).expect(200);
      expect(jira.gets).toHaveLength(0);

      // B deleting A's id answers 204 but touches nothing.
      await userB.delete(`${URL_BASE}/${aEntry.body.id as string}`).expect(204);
      expect(await ctx.prisma.trackedIssue.count()).toBe(3);
      const aAfter = await agent.get(URL_BASE).expect(200);
      expect(itemsOf(aAfter).map((i) => i.id)).toContain(aEntry.body.id);
      expect(aAfter.body.items).toHaveLength(2);
      const removedAudit = await ctx.prisma.auditEvent.count({
        where: { eventType: 'tracked_issue_removed' },
      });
      expect(removedAudit).toBe(0);

      // A deleting its own entry leaves B's list intact.
      await agent.delete(`${URL_BASE}/${aEntry.body.id as string}`).expect(204);
      expect((await userB.get(URL_BASE).expect(200)).body.items).toHaveLength(1);
    });

    it('serves B a fresh Jira read even when A already cached the same key', async () => {
      await start();
      const userB = await registerAndLogin(ctx, 'tracker-b@example.com');
      await track(agent, 'DEMO-2').expect(201);
      await agent.get(URL_BASE).expect(200);
      // B tracks after A's list is cached; B's list must read Jira for B.
      await track(userB, 'DEMO-2').expect(201);
      jira.gets.length = 0;
      await userB.get(URL_BASE).expect(200);
      expect(jira.getsFor('DEMO-2')).toBe(1);
    });
  });
});
