import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, ValidateIf } from 'class-validator';
import { WeekStartDay } from '../../generated/prisma/enums';
import { IsIanaTimeZone } from '../is-iana-timezone';

const WEEK_START_DAYS = Object.values(WeekStartDay);

const isProvided = (_: object, value: unknown) => value !== undefined;

/**
 * Partial update. Only these fields are accepted (global whitelist + forbidNonWhitelisted).
 * `timezone: null` clears the timezone; the other fields reject null.
 */
export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: WEEK_START_DAYS })
  @ValidateIf(isProvided)
  @IsIn(WEEK_START_DAYS)
  weekStartsOn?: WeekStartDay;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'IANA time zone; null clears it',
    example: 'America/Argentina/Buenos_Aires',
  })
  @IsOptional()
  @IsIanaTimeZone()
  timezone?: string | null;

  @ApiPropertyOptional()
  @ValidateIf(isProvided)
  @IsBoolean()
  showWeeklySp?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(isProvided)
  @IsBoolean()
  showSubtasks?: boolean;

  @ApiPropertyOptional()
  @ValidateIf(isProvided)
  @IsBoolean()
  showDependencies?: boolean;
}
