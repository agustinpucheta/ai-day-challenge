export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound keeps Argon2 hashing cost bounded for hostile inputs. */
export const PASSWORD_MAX_LENGTH = 256;

export function isPasswordAcceptable(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    password.trim().length > 0
  );
}
