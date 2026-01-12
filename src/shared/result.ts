/**
 * Result type for operations that may fail.
 * Provides a type-safe way to handle errors without exceptions.
 */

/**
 * Represents a successful result containing a value
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Represents a failed result containing an error
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok with a value or Err with an error
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful Result containing the given value
 * @param value - The success value
 * @returns An Ok result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates a failed Result containing the given error
 * @param error - The error value
 * @returns An Err result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Maps a function over a Result's success value
 * @param result - The result to map over
 * @param fn - The function to apply to the success value
 * @returns A new Result with the mapped value, or the original error
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Maps a function that returns a Result over a Result's success value
 * @param result - The result to flatMap over
 * @param fn - The function to apply to the success value
 * @returns The result of applying fn, or the original error
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwraps a Result, returning the value if Ok or throwing if Err
 * @param result - The result to unwrap
 * @returns The success value
 * @throws The error if result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result, returning the value if Ok or a default value if Err
 * @param result - The result to unwrap
 * @param defaultValue - The default value to return if Err
 * @returns The success value or the default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Checks if a Result is Ok
 * @param result - The result to check
 * @returns True if the result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Checks if a Result is Err
 * @param result - The result to check
 * @returns True if the result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Combines multiple Results into a single Result containing an array
 * @param results - Array of Results to combine
 * @returns Ok with array of values if all Ok, or first Err encountered
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Wraps a function that may throw into one that returns a Result
 * @param fn - The function to wrap
 * @returns A function that returns a Result instead of throwing
 */
export function tryCatch<T, A extends unknown[]>(
  fn: (...args: A) => T
): (...args: A) => Result<T, Error> {
  return (...args: A): Result<T, Error> => {
    try {
      return ok(fn(...args));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  };
}

/**
 * Wraps an async function that may throw into one that returns a Result
 * @param fn - The async function to wrap
 * @returns An async function that returns a Result instead of throwing
 */
export function tryCatchAsync<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<Result<T, Error>> {
  return async (...args: A): Promise<Result<T, Error>> => {
    try {
      return ok(await fn(...args));
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  };
}
