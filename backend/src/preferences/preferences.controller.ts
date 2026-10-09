import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { SESSION_COOKIE_NAME } from '../auth/session';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { PreferencesResponseDto } from './dto/preferences-response.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { PreferencesResponse, PreferencesService } from './preferences.service';

/** `me` routes only: the owner is always the session user, never a client-supplied id. */
@ApiTags('preferences')
@ApiCookieAuth(SESSION_COOKIE_NAME)
@Controller('users/me/preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get my preferences (defaults are created on first access)' })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  @ApiErrorResponses(401)
  get(@CurrentUser() user: AuthenticatedUser): Promise<PreferencesResponse> {
    return this.preferences.getForUser(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update my preferences (only whitelisted fields)' })
  @ApiResponse({ status: 200, type: PreferencesResponseDto })
  @ApiErrorResponses(400, 401, 403)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ): Promise<PreferencesResponse> {
    return this.preferences.updateForUser(user.id, dto);
  }
}
