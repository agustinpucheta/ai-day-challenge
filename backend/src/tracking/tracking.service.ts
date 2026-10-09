import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  JIRA_CREDENTIAL_PROVIDER,
  type JiraCredentialProvider,
} from '../jira/credentials/jira-credential-provider';
import { JiraNotConfiguredError } from '../jira/errors';
import { toAppException } from '../jira/jira-error.mapper';
import { JiraGateway } from '../jira/jira.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { mapWithConcurrency } from './concurrency';
import type { TrackedIssueEntryDto, TrackedIssuesResponseDto } from './dto/tracked-issue.dto';
import { TrackedIssueCache } from './tracked-issue.cache';
import {
  type TrackedRow,
  toErrorItem,
  toItemError,
  toLoadedIssue,
  toOkItem,
} from './tracked-issue.mapper';
import { TRACKING_OPTIONS, type TrackingOptions } from './tracking.config';

export interface AddResult {
  entry: TrackedIssueEntryDto;
  /** False when the issue was already tracked (idempotent replay). */
  created: boolean;
}

const ROW_SELECT = { id: true, issueKey: true, createdAt: true } as const;

const toEntry = (row: TrackedRow): TrackedIssueEntryDto => ({
  id: row.id,
  issueKey: row.issueKey,
  addedAt: row.createdAt.toISOString(),
});

/**
 * Per-user tracked issues. Every query is scoped by the session user id and by the configured
 * Jira site. Only the key is stored: titles, status and progress are always read from Jira.
 */
@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: JiraGateway,
    private readonly dashboard: DashboardService,
    private readonly audit: AuditService,
    private readonly cache: TrackedIssueCache,
    @Inject(JIRA_CREDENTIAL_PROVIDER) private readonly credentials: JiraCredentialProvider,
    @Inject(TRACKING_OPTIONS) private readonly options: TrackingOptions,
  ) {}

  /**
   * Verifies the issue is readable, then inserts idempotently. The per-user advisory lock makes
   * the cap check and the insert atomic; the unique constraint stays as the last guard.
   */
  async add(userId: string, issueKey: string): Promise<AddResult> {
    let siteUrl: string;
    try {
      siteUrl = (await this.credentials.resolve(userId)).siteUrl;
      await this.gateway.getIssue(userId, issueKey);
    } catch (error) {
      throw toAppException(error);
    }
    const { row, created } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const where = { userId, jiraSiteUrl: siteUrl };
      const existing = await tx.trackedIssue.findFirst({
        where: { ...where, issueKey },
        select: ROW_SELECT,
      });
      if (existing !== null) return { row: existing, created: false };
      if ((await tx.trackedIssue.count({ where })) >= this.options.maxPerUser) {
        throw new AppException(
          409,
          ErrorCode.TRACKING_LIMIT_REACHED,
          `You can follow at most ${this.options.maxPerUser} issues`,
        );
      }
      const last = await tx.trackedIssue.aggregate({ where, _max: { displayOrder: true } });
      const inserted = await tx.trackedIssue.create({
        data: {
          ...where,
          issueKey,
          displayOrder: (last._max.displayOrder ?? 0) + 1,
        },
        select: ROW_SELECT,
      });
      return { row: inserted, created: true };
    });
    if (created) {
      await this.audit.record({
        type: 'tracked_issue_added',
        success: true,
        userId,
        targetIssueKey: issueKey,
      });
    }
    return { entry: toEntry(row), created };
  }

  /**
   * The user's list in display order. A Jira failure on one item becomes that item's
   * `status: 'error'` (the list stays 200 and no fake progress is invented). When Jira is not
   * configured the current site is unknown, so every row is listed with JIRA_NOT_CONNECTED and
   * Jira is not called.
   */
  async list(userId: string, refresh: boolean): Promise<TrackedIssuesResponseDto> {
    const siteUrl = await this.currentSite(userId);
    const rows = await this.prisma.trackedIssue.findMany({
      where: { userId, ...(siteUrl !== null && { jiraSiteUrl: siteUrl }) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: ROW_SELECT,
    });
    const items =
      siteUrl === null
        ? rows.map((row) =>
            toErrorItem(
              row,
              toItemError(toAppException(new JiraNotConfiguredError())),
              new Date().toISOString(),
            ),
          )
        : await mapWithConcurrency(rows, this.options.loadConcurrency, (row) =>
            this.loadItem(userId, siteUrl, row, refresh),
          );
    return { items, metadata: { fetchedAt: new Date().toISOString() } };
  }

  /** Idempotent: removes only the caller's row and never reveals whether it existed. */
  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.trackedIssue.findFirst({
      where: { id, userId },
      select: { issueKey: true, jiraSiteUrl: true },
    });
    if (row === null) return;
    const { count } = await this.prisma.trackedIssue.deleteMany({ where: { id, userId } });
    if (count === 0) return;
    this.cache.delete(userId, row.jiraSiteUrl, row.issueKey);
    await this.audit.record({
      type: 'tracked_issue_removed',
      success: true,
      userId,
      targetIssueKey: row.issueKey,
    });
  }

  private async currentSite(userId: string): Promise<string | null> {
    try {
      return (await this.credentials.resolve(userId)).siteUrl;
    } catch (error) {
      if (error instanceof JiraNotConfiguredError) return null;
      throw error;
    }
  }

  private async loadItem(userId: string, siteUrl: string, row: TrackedRow, refresh: boolean) {
    if (!refresh) {
      const cached = this.cache.get(userId, siteUrl, row.issueKey);
      if (cached !== undefined) return toOkItem(row, cached);
    }
    try {
      const loaded = toLoadedIssue(await this.dashboard.getIssue(userId, row.issueKey));
      this.cache.set(userId, siteUrl, row.issueKey, loaded);
      return toOkItem(row, loaded);
    } catch (error) {
      if (!(error instanceof AppException)) {
        this.logger.warn(
          `Unexpected failure loading a tracked issue (${error instanceof Error ? error.name : 'unknown'})`,
        );
      }
      // Failures are never cached: the next list retries Jira.
      return toErrorItem(row, toItemError(error), new Date().toISOString());
    }
  }
}
