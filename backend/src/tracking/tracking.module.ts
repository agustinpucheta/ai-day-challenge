import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { JiraModule } from '../jira/jira.module';
import { TrackedIssueCache } from './tracked-issue.cache';
import { TRACKING_CONFIG, TRACKING_OPTIONS, type TrackingOptions } from './tracking.config';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [JiraModule, DashboardModule, AuditModule],
  controllers: [TrackingController],
  providers: [
    { provide: TRACKING_OPTIONS, useValue: TRACKING_CONFIG },
    {
      provide: TrackedIssueCache,
      inject: [TRACKING_OPTIONS],
      useFactory: (options: TrackingOptions) =>
        new TrackedIssueCache(options.cacheTtlMs, options.cacheMaxEntries),
    },
    TrackingService,
  ],
})
export class TrackingModule {}
