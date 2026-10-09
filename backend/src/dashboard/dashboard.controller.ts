import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { SESSION_COOKIE_NAME } from '../auth/session';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { DashboardService } from './dashboard.service';
import { DashboardIssueResponseDto, IssueSearchResponseDto } from './dto/issue.dto';
import { IssueKeyParamDto, SearchIssuesQueryDto } from './dto/search-issues-query.dto';

/** The user comes only from the session; the client never supplies an identity or credentials. */
@ApiTags('jira')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('jira/issues')
export class JiraIssuesController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search Jira issues by text or key (read-only, token-paginated)' })
  @ApiResponse({ status: 200, type: IssueSearchResponseDto })
  @ApiErrorResponses(400, 401, 409, 424, 429, 503)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchIssuesQueryDto,
  ): Promise<IssueSearchResponseDto> {
    return this.dashboard.search(user.id, query);
  }
}

@ApiTags('dashboard')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('dashboard/issues')
export class DashboardIssuesController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get(':issueKey')
  @ApiOperation({ summary: 'Issue detail with subtasks and story points (read-only)' })
  @ApiResponse({ status: 200, type: DashboardIssueResponseDto })
  @ApiErrorResponses(400, 401, 404, 409, 424, 429, 503)
  getIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IssueKeyParamDto,
  ): Promise<DashboardIssueResponseDto> {
    return this.dashboard.getIssue(user.id, params.issueKey);
  }
}
