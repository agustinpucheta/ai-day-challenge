import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ISSUE_KEY_PATTERN, MAX_QUERY_LENGTH, containsControlChars } from '../../jira/jira-jql';
import { JIRA_CONFIG } from '../../jira/jira.config';

export const MIN_QUERY_LENGTH = 2;
export const MAX_PAGE_TOKEN_LENGTH = 2000;
/** URL-safe, opaque cursor charset (base64/base64url plus a few separators). */
const PAGE_TOKEN_PATTERN = /^[A-Za-z0-9._~+/=:-]+$/;

@ValidatorConstraint({ name: 'noControlChars' })
class NoControlChars implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && !containsControlChars(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must not contain control characters`;
  }
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SearchIssuesQueryDto {
  @ApiProperty({
    description: 'Free text or an issue key (e.g. MASIN-123). Trimmed, 2 to 100 characters.',
    minLength: MIN_QUERY_LENGTH,
    maxLength: MAX_QUERY_LENGTH,
    example: 'MASIN-123',
  })
  @Transform(trim)
  @IsString()
  @MinLength(MIN_QUERY_LENGTH)
  @MaxLength(MAX_QUERY_LENGTH)
  @Validate(NoControlChars)
  q!: string;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextPageToken by the previous page.',
    maxLength: MAX_PAGE_TOKEN_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PAGE_TOKEN_LENGTH)
  @Matches(PAGE_TOKEN_PATTERN, { message: 'pageToken contains invalid characters' })
  pageToken?: string;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: JIRA_CONFIG.search.maxPageSize,
    default: JIRA_CONFIG.search.defaultPageSize,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(JIRA_CONFIG.search.maxPageSize)
  pageSize?: number;
}

export class IssueKeyParamDto {
  @ApiProperty({ example: 'MASIN-123' })
  @IsString()
  @MaxLength(60)
  @Matches(ISSUE_KEY_PATTERN, { message: 'issueKey must be a valid Jira issue key' })
  issueKey!: string;
}
