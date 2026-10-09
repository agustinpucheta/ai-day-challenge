import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { SESSION_COOKIE_NAME } from '../auth/session';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { JiraConnectionStatusDto, JiraConnectionVerifyDto } from './dto/jira-connection.dto';
import { JiraConnectionService } from './jira-connection.service';

/** The user comes only from the session; the client never supplies an identity. */
@ApiTags('jira')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('jira/connection')
export class JiraConnectionController {
  constructor(private readonly connection: JiraConnectionService) {}

  @Get()
  @ApiOperation({ summary: 'Jira connection state (no network call, no secrets)' })
  @ApiResponse({ status: 200, type: JiraConnectionStatusDto })
  @ApiErrorResponses(401)
  status(@CurrentUser() user: AuthenticatedUser): Promise<JiraConnectionStatusDto> {
    return this.connection.status(user.id);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify the Jira credentials with a read-only call to /myself' })
  @ApiResponse({ status: 200, type: JiraConnectionVerifyDto })
  @ApiErrorResponses(401, 403, 409, 424, 429, 503)
  verify(@CurrentUser() user: AuthenticatedUser): Promise<JiraConnectionVerifyDto> {
    return this.connection.verify(user.id);
  }
}
