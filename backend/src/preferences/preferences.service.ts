import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PreferencesResponseDto } from './dto/preferences-response.dto';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto';

export type PreferencesResponse = PreferencesResponseDto;

const PREFERENCES_SELECT = {
  weekStartsOn: true,
  timezone: true,
  showWeeklySp: true,
  showSubtasks: true,
  showDependencies: true,
  updatedAt: true,
} as const;

type PreferencesRow = Omit<PreferencesResponse, 'updatedAt'> & { updatedAt: Date };

function toResponse(row: PreferencesRow): PreferencesResponse {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}

/** Every query is scoped by the session user id passed in by the controller. */
@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the user's preferences, creating defaults on first access. */
  async getForUser(userId: string): Promise<PreferencesResponse> {
    const row = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: PREFERENCES_SELECT,
    });
    return toResponse(row);
  }

  async updateForUser(userId: string, dto: UpdatePreferencesDto): Promise<PreferencesResponse> {
    const data = {
      ...(dto.weekStartsOn !== undefined && { weekStartsOn: dto.weekStartsOn }),
      ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      ...(dto.showWeeklySp !== undefined && { showWeeklySp: dto.showWeeklySp }),
      ...(dto.showSubtasks !== undefined && { showSubtasks: dto.showSubtasks }),
      ...(dto.showDependencies !== undefined && { showDependencies: dto.showDependencies }),
    };
    const row = await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: PREFERENCES_SELECT,
    });
    return toResponse(row);
  }
}
