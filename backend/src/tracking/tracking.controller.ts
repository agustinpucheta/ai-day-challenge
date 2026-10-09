import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { SESSION_COOKIE_NAME } from '../auth/session';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { TrackedIssueEntryDto, TrackedIssuesResponseDto } from './dto/tracked-issue.dto';
import {
  AddTrackedIssueDto,
  ListTrackedIssuesQueryDto,
  TrackedIssueIdParamDto,
} from './dto/tracked-issue-requests.dto';
import { TrackingService } from './tracking.service';

/** `me` routes only: the owner is always the session user, never a client-supplied id. */
@ApiTags('tracking')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('users/me/tracked-issues')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post()
  @ApiOperation({
    summary: 'Follow an issue (verified readable in Jira first; idempotent)',
  })
  @ApiResponse({ status: 201, type: TrackedIssueEntryDto, description: 'Newly tracked.' })
  @ApiResponse({ status: 200, type: TrackedIssueEntryDto, description: 'Already tracked.' })
  @ApiErrorResponses(400, 401, 403, 404, 409, 424, 429, 503)
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddTrackedIssueDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TrackedIssueEntryDto> {
    const { entry, created } = await this.tracking.add(user.id, dto.issueKey);
    res.status(created ? 201 : 200);
    return entry;
  }

  @Get()
  @ApiOperation({
    summary: 'My followed issues with progress; one failing issue never fails the list',
  })
  @ApiResponse({ status: 200, type: TrackedIssuesResponseDto })
  @ApiErrorResponses(400, 401)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTrackedIssuesQueryDto,
  ): Promise<TrackedIssuesResponseDto> {
    return this.tracking.list(user.id, query.refresh === true);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop following an issue (idempotent; only my own entries)' })
  @ApiResponse({ status: 204, description: 'Removed, or nothing to remove.' })
  @ApiErrorResponses(400, 401, 403)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: TrackedIssueIdParamDto,
  ): Promise<void> {
    await this.tracking.remove(user.id, params.id);
  }
}
