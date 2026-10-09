import { Injectable } from '@nestjs/common';
import { toAppException } from '../jira/jira-error.mapper';
import { JiraGateway } from '../jira/jira.gateway';
import type { DashboardIssueResponseDto, IssueSearchResponseDto } from './dto/issue.dto';
import type { SearchIssuesQueryDto } from './dto/search-issues-query.dto';
import { toDashboardIssueResponse, toIssueSummaryDto } from './issue.mapper';

/**
 * Read-only issue search and detail for the HTTP layer. Credentials are resolved by the gateway
 * from the session user; a Jira failure is always an error, never an empty result.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly gateway: JiraGateway) {}

  async search(userId: string, query: SearchIssuesQueryDto): Promise<IssueSearchResponseDto> {
    try {
      const page = await this.gateway.searchIssues(userId, {
        query: query.q,
        pageToken: query.pageToken,
        pageSize: query.pageSize,
      });
      return {
        items: page.issues.map(toIssueSummaryDto),
        nextPageToken: page.nextPageToken,
        metadata: { fetchedAt: page.fetchedAt, isStale: false },
      };
    } catch (error) {
      throw toAppException(error);
    }
  }

  async getIssue(userId: string, issueKey: string): Promise<DashboardIssueResponseDto> {
    try {
      const { issue, fetchedAt } = await this.gateway.getIssue(userId, issueKey);
      return toDashboardIssueResponse(issue, fetchedAt);
    } catch (error) {
      throw toAppException(error);
    }
  }
}
