import { ValidationOptions, registerDecorator } from 'class-validator';

// Region/City style names plus plain identifiers such as "UTC". Rejects raw offsets like "+03:00".
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    return false;
  }
  if (!IANA_NAME.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: { message: '$property must be a valid IANA time zone', ...options },
      validator: { validate: (value: unknown) => isIanaTimeZone(value) },
    });
  };
}
