/**
 * Result Type - Functional error handling pattern
 * Provides a type-safe way to handle success and error cases without exceptions.
 */

/**
 * Represents a successful result containing a value of type T.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Represents a failed result containing an error of type E.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * A Result type that can be either Ok<T> or Err<E>.
 * Use this for operations that can fail in an expected way.
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful Result containing the given value.
 * @param value The success value
 * @returns An Ok result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result containing the given error.
 * @param error The error value
 * @returns An Err result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is Ok.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if a Result is Err.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwraps a Result, returning the value if Ok, or throwing the error if Err.
 * @throws The error if the result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result, returning the value if Ok, or the default value if Err.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to the Ok value.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to the Err value.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (result.ok) {
    return result;
  }
  return err(fn(result.error));
}

/**
 * Chains Result operations. If Ok, applies fn and returns the new Result.
 * If Err, returns the Err unchanged.
 */
export function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Wraps a function that might throw into a Result.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Wraps an async function that might throw into a Promise<Result>.
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
