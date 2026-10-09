import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../password-policy';

/**
 * Login deliberately does not apply the password policy or strict email format:
 * any well-formed request gets the same generic 401 when credentials do not match.
 */
export class LoginDto {
  @ApiProperty({ maxLength: 320, example: 'ana@example.com' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ format: 'password', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
