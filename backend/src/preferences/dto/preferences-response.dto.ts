import { ApiProperty } from '@nestjs/swagger';
import { WeekStartDay } from '../../generated/prisma/enums';

export class PreferencesResponseDto {
  @ApiProperty({ enum: Object.values(WeekStartDay), example: WeekStartDay.monday })
  weekStartsOn!: WeekStartDay;

  @ApiProperty({ type: String, nullable: true, example: 'America/Argentina/Buenos_Aires' })
  timezone!: string | null;

  @ApiProperty()
  showWeeklySp!: boolean;

  @ApiProperty()
  showSubtasks!: boolean;

  @ApiProperty()
  showDependencies!: boolean;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
