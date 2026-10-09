import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { ApiErrorResponses } from '../common/errors/api-error-responses';
import { AppException } from '../common/errors/app-exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Application and database health (no configuration details)' })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @ApiErrorResponses(503)
  async check(): Promise<HealthResponseDto> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(503, ErrorCode.DATABASE_UNAVAILABLE, 'Database is unavailable');
    }
    return { status: 'ok', database: 'up', checkedAt: new Date().toISOString() };
  }
}
