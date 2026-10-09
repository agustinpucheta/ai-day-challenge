import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from './error-codes';

export class ValidationDetailDto {
  @ApiProperty({ example: 'password' })
  field!: string;

  @ApiProperty({
    type: [String],
    example: ['password must be longer than or equal to 12 characters'],
  })
  constraints!: string[];
}

/** OpenAPI schema of the normalized error body produced by HttpErrorFilter. */
export class ErrorResponseDto {
  @ApiProperty({ enum: Object.values(ErrorCode), example: ErrorCode.UNAUTHENTICATED })
  code!: string;

  @ApiProperty({ example: 'Authentication required' })
  message!: string;

  @ApiPropertyOptional({
    type: [ValidationDetailDto],
    description: 'Present only for VALIDATION_ERROR',
  })
  details?: ValidationDetailDto[];
}
