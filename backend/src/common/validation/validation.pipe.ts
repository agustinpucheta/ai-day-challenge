import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app-exception';
import { ErrorCode, ValidationDetail } from '../errors/error-codes';

function flatten(errors: ValidationError[], parent = ''): ValidationDetail[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: ValidationDetail[] = error.constraints
      ? [{ field, constraints: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Never echo submitted values (they may include passwords).
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new AppException(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Request validation failed',
        flatten(errors),
      ),
  });
}
