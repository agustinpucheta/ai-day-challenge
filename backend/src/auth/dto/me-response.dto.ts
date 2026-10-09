import { ApiProperty } from '@nestjs/swagger';

export class JiraStatusDto {
  @ApiProperty({ description: 'Placeholder until Phase 2 (Jira OAuth)', example: false })
  connected!: boolean;
}

/** Current user. Never includes credentials. */
export class MeResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Ana' })
  displayName!: string | null;

  @ApiProperty({ type: JiraStatusDto })
  jira!: JiraStatusDto;
}
