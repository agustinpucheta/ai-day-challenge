import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import type { Env } from '../config/env';
import { AuthService } from './auth.service';
import { AuthenticatedUser, MeResponse, toMeResponse } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';
import {
  SESSION_COOKIE_NAME,
  destroySession,
  regenerateSession,
  saveSession,
  sessionCookieOptions,
} from './session';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  @ApiOperation({
    summary: 'Register a local account',
    description: 'Only when LOCAL_REGISTRATION_ENABLED=true. Does not log in.',
  })
  @ApiResponse({ status: 201, type: MeResponseDto })
  @ApiErrorResponses(400, 403, 409, 429)
  async register(@Body() dto: RegisterDto): Promise<MeResponse> {
    if (!this.config.get('LOCAL_REGISTRATION_ENABLED', { infer: true })) {
      throw new AppException(
        403,
        ErrorCode.REGISTRATION_DISABLED,
        'Local registration is disabled',
      );
    }
    const user = await this.auth.register(dto);
    return toMeResponse(user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in with email and password',
    description: `Creates a server-side session and sets the ${SESSION_COOKIE_NAME} cookie.`,
  })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiErrorResponses(400, 401, 403, 429)
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<MeResponse> {
    const user = await this.auth.login(dto.email, dto.password);
    // New session id on privilege change prevents session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    return toMeResponse(user);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Destroy the current session and clear the cookie (idempotent)' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiErrorResponses(403)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const userId = req.session?.userId;
    if (req.session) {
      await destroySession(req);
    }
    res.clearCookie(
      SESSION_COOKIE_NAME,
      sessionCookieOptions(this.config.get('NODE_ENV', { infer: true })),
    );
    if (userId) {
      await this.auth.recordLogout(userId);
    }
  }

  @Get('me')
  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({ summary: 'Current user and Jira connection status' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  @ApiErrorResponses(401)
  me(@CurrentUser() user: AuthenticatedUser): MeResponse {
    return toMeResponse(user);
  }
}
