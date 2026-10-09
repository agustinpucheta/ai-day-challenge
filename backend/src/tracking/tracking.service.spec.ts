import { Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception';
import type { AuditService } from '../audit/audit.service';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { DashboardIssueResponseDto } from '../dashboard/dto/issue.dto';
import { JiraIssueNotFoundError, JiraNotConfiguredError } from '../jira/errors';
import type { JiraGateway } from '../jira/jira.gateway';
import type { PrismaService } from '../prisma/prisma.service';
import { TrackedIssueCache } from './tracked-issue.cache';
import { TrackingService } from './tracking.service';
import type { TrackingOptions } from './tracking.config';

const SITE = 'https://acme.atlassian.net';
const OPTIONS: TrackingOptions = {
  maxPerUser: 2,
  cacheTtlMs: 60_000,
  cacheMaxEntries: 100,
  loadConcurrency: 2,
};

interface Row {
  id: string;
  userId: string;
  jiraSiteUrl: string;
  issueKey: string;
  displayOrder: number;
  createdAt: Date;
}

/** In-memory stand-in for the few Prisma calls the service uses. */
class FakePrisma {
  rows: Row[] = [];
  readonly trackedIssue = {
    findFirst: ({ where }: { where: Partial<Row> }) =>
      Promise.resolve(this.match(where)[0] ?? null),
    findMany: ({ where }: { where: Partial<Row> }) => Promise.resolve(this.match(where)),
    count: ({ where }: { where: Partial<Row> }) => Promise.resolve(this.match(where).length),
    aggregate: ({ where }: { where: Partial<Row> }) =>
      Promise.resolve({
        _max: {
          displayOrder: Math.max(0, ...this.match(where).map((r) => r.displayOrder)) || null,
        },
      }),
    create: ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
      const row = { ...data, id: `id-${this.rows.length + 1}`, createdAt: new Date() };
      this.rows.push(row);
      return Promise.resolve(row);
    },
    deleteMany: ({ where }: { where: Partial<Row> }) => {
      const doomed = this.match(where);
      this.rows = this.rows.filter((r) => !doomed.includes(r));
      return Promise.resolve({ count: doomed.length });
    },
  };

  $executeRaw = () => Promise.resolve(0);
  $transaction = <T>(fn: (tx: this) => Promise<T>) => fn(this);

  private match(where: Partial<Row>): Row[] {
    return this.rows.filter((r) =>
      Object.entries(where).every(([k, v]) => r[k as keyof Row] === v),
    );
  }
}

function detail(key: string, hierarchyLevel = 0): DashboardIssueResponseDto {
  return {
    issue: {
      id: '1',
      key,
      summary: `Summary ${key}`,
      issueType: { id: '1', name: 'Story', hierarchyLevel, isSubtask: false },
      status: { name: 'To do', categoryKey: 'new', isCancelled: false, isAvailable: false },
      url: `${SITE}/browse/${key}`,
      parentKey: null,
      storyPoints: { final: null, planned: null },
    },
    subtasks: [],
    progress: {
      basis: 'subtasks',
      state: 'none',
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      available: 0,
      cancelled: 0,
      unknown: 0,
      percent: null,
      isApproximate: false,
    },
    ...(hierarchyLevel > 0 && { children: [] }),
    metadata: { fetchedAt: '2026-10-09T10:00:00.000Z', isStale: false, warnings: [] },
  };
}

describe('TrackingService', () => {
  let prisma: FakePrisma;
  let getIssueGateway: jest.Mock;
  let getIssueDashboard: jest.Mock;
  let audit: { record: jest.Mock };
  let resolve: jest.Mock;
  let service: TrackingService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = new FakePrisma();
    getIssueGateway = jest.fn().mockResolvedValue({});
    getIssueDashboard = jest.fn((_user: string, key: string) => Promise.resolve(detail(key)));
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    resolve = jest.fn().mockResolvedValue({ siteUrl: SITE });
    service = new TrackingService(
      prisma as unknown as PrismaService,
      { getIssue: getIssueGateway } as unknown as JiraGateway,
      { getIssue: getIssueDashboard } as unknown as DashboardService,
      audit as unknown as AuditService,
      new TrackedIssueCache(OPTIONS.cacheTtlMs, OPTIONS.cacheMaxEntries),
      { resolve },
      OPTIONS,
    );
  });

  describe('add', () => {
    it('creates once, replays idempotently and audits only the creation', async () => {
      const first = await service.add('u1', 'DEMO-1');
      const again = await service.add('u1', 'DEMO-1');
      expect(first.created).toBe(true);
      expect(again).toEqual({ entry: first.entry, created: false });
      expect(prisma.rows).toHaveLength(1);
      expect(audit.record).toHaveBeenCalledTimes(1);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tracked_issue_added', targetIssueKey: 'DEMO-1' }),
      );
    });

    it('enforces the per-user cap but still answers an already tracked key', async () => {
      await service.add('u1', 'DEMO-1');
      await service.add('u1', 'DEMO-2');
      await expect(service.add('u1', 'DEMO-3')).rejects.toMatchObject({
        status: 409,
        response: { code: 'TRACKING_LIMIT_REACHED' },
      });
      expect((await service.add('u1', 'DEMO-2')).created).toBe(false);
      // The cap is per user.
      expect((await service.add('u2', 'DEMO-3')).created).toBe(true);
      expect(prisma.rows.map((r) => r.displayOrder)).toEqual([1, 2, 1]);
    });

    it('maps an unreadable issue and missing credentials, inserting nothing', async () => {
      getIssueGateway.mockRejectedValueOnce(new JiraIssueNotFoundError(403));
      await expect(service.add('u1', 'DEMO-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE' },
      });
      resolve.mockRejectedValueOnce(new JiraNotConfiguredError());
      await expect(service.add('u1', 'DEMO-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'JIRA_NOT_CONNECTED' },
      });
      expect(prisma.rows).toHaveLength(0);
    });
  });

  describe('list', () => {
    const seed = async (user: string, keys: string[]) => {
      for (const key of keys) await service.add(user, key);
    };

    it('serves from the cache within the TTL with the original fetchedAt and bypasses on refresh', async () => {
      await seed('u1', ['DEMO-1']);
      await service.list('u1', false);
      const cached = await service.list('u1', false);
      expect(getIssueDashboard).toHaveBeenCalledTimes(1);
      expect(cached.items[0]?.fetchedAt).toBe('2026-10-09T10:00:00.000Z');
      await service.list('u1', true);
      expect(getIssueDashboard).toHaveBeenCalledTimes(2);
    });

    it('never serves one user the cached result of another', async () => {
      await seed('u1', ['DEMO-1']);
      await seed('u2', ['DEMO-1']);
      await service.list('u1', false);
      await service.list('u2', false);
      expect(getIssueDashboard).toHaveBeenCalledTimes(2);
    });

    it('turns a failing item into an error item (not cached) and keeps the others ok', async () => {
      await seed('u1', ['DEMO-1', 'DEMO-2']);
      getIssueDashboard.mockImplementation((_u: string, key: string) =>
        key === 'DEMO-1'
          ? Promise.reject(
              new AppException(404, 'ISSUE_NOT_FOUND_OR_INACCESSIBLE', 'The issue is gone'),
            )
          : Promise.resolve(detail(key)),
      );
      const res = await service.list('u1', false);
      const [bad, good] = res.items;
      expect(bad).toEqual({
        id: expect.any(String),
        issueKey: 'DEMO-1',
        addedAt: expect.any(String),
        status: 'error',
        fetchedAt: expect.any(String),
        error: { code: 'ISSUE_NOT_FOUND_OR_INACCESSIBLE', message: 'The issue is gone' },
      });
      expect(bad).not.toHaveProperty('progress');
      expect(good).toMatchObject({ status: 'ok', issueKey: 'DEMO-2' });
      await service.list('u1', false);
      expect(getIssueDashboard.mock.calls.filter(([, key]) => key === 'DEMO-1')).toHaveLength(2);
    });

    it('hides the details of an unexpected failure', async () => {
      await seed('u1', ['DEMO-1']);
      getIssueDashboard.mockRejectedValue(new Error('boom with secret-token'));
      const res = await service.list('u1', false);
      expect(res.items[0]?.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'The issue could not be loaded',
      });
      expect(JSON.stringify(res)).not.toContain('secret-token');
    });

    it('reports childrenCount for epics only', async () => {
      await seed('u1', ['DEMO-1', 'DEMO-2']);
      getIssueDashboard.mockImplementation((_u: string, key: string) =>
        Promise.resolve(detail(key, key === 'DEMO-1' ? 1 : 0)),
      );
      const res = await service.list('u1', false);
      expect(res.items[0]).toMatchObject({ childrenCount: 0 });
      expect(res.items[1]).not.toHaveProperty('childrenCount');
    });

    it('never has more reads in flight than the configured concurrency', async () => {
      await seed('u1', ['DEMO-1', 'DEMO-2']);
      const keys = ['DEMO-3', 'DEMO-4', 'DEMO-5', 'DEMO-6'];
      prisma.rows.push(
        ...keys.map((issueKey, i) => ({
          id: `x${i}`,
          userId: 'u1',
          jiraSiteUrl: SITE,
          issueKey,
          displayOrder: 10 + i,
          createdAt: new Date(),
        })),
      );
      let inFlight = 0;
      let peak = 0;
      getIssueDashboard.mockImplementation(async (_u: string, key: string) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setImmediate(r));
        inFlight -= 1;
        return detail(key);
      });
      const res = await service.list('u1', true);
      expect(res.items).toHaveLength(6);
      expect(peak).toBe(OPTIONS.loadConcurrency);
    });

    it('lists every row as JIRA_NOT_CONNECTED without calling Jira when not configured', async () => {
      await seed('u1', ['DEMO-1']);
      resolve.mockRejectedValue(new JiraNotConfiguredError());
      const res = await service.list('u1', false);
      expect(res.items[0]).toMatchObject({
        status: 'error',
        error: { code: 'JIRA_NOT_CONNECTED' },
      });
      expect(getIssueDashboard).not.toHaveBeenCalled();
    });

    it('only lists entries of the configured site', async () => {
      await seed('u1', ['DEMO-1']);
      prisma.rows.push({
        id: 'old',
        userId: 'u1',
        jiraSiteUrl: 'https://old.atlassian.net',
        issueKey: 'OLD-1',
        displayOrder: 1,
        createdAt: new Date(),
      });
      const res = await service.list('u1', false);
      expect(res.items.map((i) => i.issueKey)).toEqual(['DEMO-1']);
    });
  });

  describe('remove', () => {
    it('removes only the caller row, is idempotent and audits once', async () => {
      const { entry } = await service.add('u1', 'DEMO-1');
      audit.record.mockClear();
      await service.remove('u2', entry.id);
      expect(prisma.rows).toHaveLength(1);
      expect(audit.record).not.toHaveBeenCalled();
      await service.remove('u1', entry.id);
      await service.remove('u1', entry.id);
      expect(prisma.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledTimes(1);
    });
  });
});
