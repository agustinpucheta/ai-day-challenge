import { inspect } from 'node:util';

const REDACTED = '[REDACTED]';

/**
 * Holds a secret so that logging, string interpolation, `JSON.stringify` and `util.inspect`
 * of any object containing it print a placeholder. The raw value is only reachable
 * through the explicit `reveal()` call.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [inspect.custom](): string {
    return REDACTED;
  }
}
