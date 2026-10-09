import { Module } from '@nestjs/common';
import { JiraModule } from '../jira/jira.module';
import { DashboardIssuesController, JiraIssuesController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [JiraModule],
  controllers: [JiraIssuesController, DashboardIssuesController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
