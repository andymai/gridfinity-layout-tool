/**
 * Utility functions for working with Result types.
 *
 * This module provides ergonomic helpers for:
 * - Transformations: map, mapErr, flatMap/andThen
 * - Extraction: unwrap, unwrapOr, unwrapOrElse
 * - Pattern matching: match
 * - Combining: combine, collect, collectAll
 * - Boolean operations: or, and
 * - Try-catch wrappers: tryCatch, tryCatchAsync
 * - Side effects: tap, tapErr
 *
 * These utilities are inspired by Rust's Result type and functional
 * programming patterns, adapted for TypeScript ergonomics.
 */

import type { Result, Unit } from './types';
import { ok, err, isOk, isErr, OK } from './types';

// =============================================================================
// Mapping & Transformation
// =============================================================================

/**
 * Transform the Ok value while preserving Err.
 *
 * @example
 * ```ts
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * // { ok: true, value: 10 }
 * ```
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the Err value while preserving Ok.
 *
 * @example
 * ```ts
 * const result = err({ code: 'NOT_FOUND' });
 * const mapped = mapErr(result, e => ({ ...e, logged: true }));
 * ```
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain operations that return Results (flatMap).
 * This is the core function for composing Result-returning operations.
 *
 * @example
 * ```ts
 * const divide = (a: number, b: number): Result<number, string> =>
 *   b === 0 ? err('Division by zero') : ok(a / b);
 *
 * const result = flatMap(ok(10), x => divide(x, 2));
 * // { ok: true, value: 5 }
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Alias for flatMap (Rust terminology).
 */
export const andThen = flatMap;

// =============================================================================
// Value Extraction
// =============================================================================

/**
 * Extract the Ok value, throwing if Err.
 * Use sparingly - prefer match() or isOk() checks.
 *
 * @throws Error if Result is not Ok
 *
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrap(result); // 42
 *
 * const errorResult = err('failed');
 * unwrap(errorResult); // throws Error
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Called unwrap on an Err: ${JSON.stringify(result.error)}`);
}

/**
 * Extract the Ok value, or return a default value if Err.
 *
 * @example
 * ```ts
 * const result = err('not found');
 * const value = unwrapOr(result, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}

/**
 * Extract the Ok value, or compute a default from the error.
 *
 * @example
 * ```ts
 * const result = err({ code: 'NOT_FOUND', defaultId: 'default' });
 * const value = unwrapOrElse(result, e => e.defaultId);
 * // 'default'
 * ```
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  return isOk(result) ? result.value : fn(result.error);
}

/**
 * Extract the Err value, throwing if Ok.
 * Useful for testing error paths.
 *
 * @throws Error if Result is Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error(`Called unwrapErr on an Ok: ${JSON.stringify(result.value)}`);
}

// =============================================================================
// Pattern Matching
// =============================================================================

/**
 * Pattern match on Result - exhaustive handler.
 * This is the most ergonomic way to handle Results.
 *
 * @example
 * ```ts
 * const message = match(loadUser(id), {
 *   ok: (user) => `Hello ${user.name}`,
 *   err: (error) => `Error: ${error.message}`
 * });
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

// =============================================================================
// Combining Results
// =============================================================================

/**
 * Combine two Results into a tuple.
 * Returns the first Err if either is Err.
 *
 * @example
 * ```ts
 * const r1 = ok(1);
 * const r2 = ok('hello');
 * const combined = combine(r1, r2);
 * // { ok: true, value: [1, 'hello'] }
 * ```
 */
export function combine<T1, T2, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>
): Result<[T1, T2], E> {
  if (isErr(r1)) return r1;
  if (isErr(r2)) return r2;
  return ok([r1.value, r2.value]);
}

/**
 * Combine three Results into a tuple.
 */
export function combine3<T1, T2, T3, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>
): Result<[T1, T2, T3], E> {
  if (isErr(r1)) return r1;
  if (isErr(r2)) return r2;
  if (isErr(r3)) return r3;
  return ok([r1.value, r2.value, r3.value]);
}

/**
 * Collect an array of Results into a Result of array.
 * Returns the first Err if any Result is Err.
 *
 * @example
 * ```ts
 * const results = [ok(1), ok(2), ok(3)];
 * const collected = collect(results);
 * // { ok: true, value: [1, 2, 3] }
 *
 * const mixed = [ok(1), err('failed'), ok(3)];
 * const failed = collect(mixed);
 * // { ok: false, error: 'failed' }
 * ```
 */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Collect an array of Results, accumulating all errors.
 * Returns Ok with all values if all succeed, or Err with all errors.
 *
 * @example
 * ```ts
 * const results = [ok(1), err('a'), ok(2), err('b')];
 * const collected = collectAll(results);
 * // { ok: false, error: ['a', 'b'] }
 * ```
 */
export function collectAll<T, E>(results: Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (isOk(result)) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return err(errors);
  }
  return ok(values);
}

// =============================================================================
// Boolean Operations
// =============================================================================

/**
 * Return the first Ok, or the last Err if all fail.
 * Useful for fallback chains.
 *
 * @example
 * ```ts
 * const result = or(
 *   loadFromCache(id),
 *   loadFromDatabase(id)
 * );
 * ```
 */
export function or<T, E>(r1: Result<T, E>, r2: Result<T, E>): Result<T, E> {
  if (isOk(r1)) return r1;
  return r2;
}

/**
 * Return r2 if r1 is Ok, otherwise return r1's Err.
 * Useful when you need both operations to succeed but only want the second value.
 */
export function and<T, U, E>(r1: Result<T, E>, r2: Result<U, E>): Result<U, E> {
  if (isErr(r1)) return r1;
  return r2;
}

// =============================================================================
// Try-Catch Wrappers
// =============================================================================

/**
 * Wrap a synchronous function that may throw into a Result.
 *
 * @example
 * ```ts
 * const result = tryCatch(
 *   () => JSON.parse(jsonString),
 *   (error) => storageCorrupted('key', [String(error)])
 * );
 * ```
 */
export function tryCatch<T, E = unknown>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(mapError ? mapError(error) : (error as E));
  }
}

/**
 * Wrap an async function that may throw into a Promise<Result>.
 *
 * @example
 * ```ts
 * const result = await tryCatchAsync(
 *   () => fetch('/api/data').then(r => r.json()),
 *   (error) => apiNetworkError(error)
 * );
 * ```
 */
export async function tryCatchAsync<T, E = unknown>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(mapError ? mapError(error) : (error as E));
  }
}

// =============================================================================
// Void/Unit Helpers
// =============================================================================

/**
 * Convert any Ok result to Ok<Unit>.
 * Useful when you don't care about the value, only success/failure.
 *
 * @example
 * ```ts
 * const result = saveFile(data); // Result<FileInfo, Error>
 * const voidResult = toUnit(result); // Result<void, Error>
 * ```
 */
export function toUnit<T, E>(result: Result<T, E>): Result<Unit, E> {
  if (isOk(result)) {
    return OK;
  }
  return result;
}

/**
 * Perform a side effect if Result is Ok, then return the original result.
 * Useful for logging or other side effects without changing the result.
 *
 * @example
 * ```ts
 * const result = tap(loadUser(id), (user) => {
 *   console.log('Loaded user:', user.name);
 * });
 * ```
 */
export function tap<T, E>(
  result: Result<T, E>,
  fn: (value: T) => void
): Result<T, E> {
  if (isOk(result)) {
    fn(result.value);
  }
  return result;
}

/**
 * Perform a side effect if Result is Err, then return the original result.
 * Useful for logging errors without changing the result.
 *
 * @example
 * ```ts
 * const result = tapErr(loadUser(id), (error) => {
 *   console.error('Failed to load user:', error.message);
 * });
 * ```
 */
export function tapErr<T, E>(
  result: Result<T, E>,
  fn: (error: E) => void
): Result<T, E> {
  if (isErr(result)) {
    fn(result.error);
  }
  return result;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if all Results in an array are Ok.
 */
export function allOk<T, E>(results: Result<T, E>[]): boolean {
  return results.every(isOk);
}

/**
 * Check if any Result in an array is Err.
 */
export function anyErr<T, E>(results: Result<T, E>[]): boolean {
  return results.some(isErr);
}

/**
 * Get all Ok values from an array of Results.
 * Filters out Err results and returns only the Ok values.
 */
export function filterOk<T, E>(results: Result<T, E>[]): T[] {
  return results.filter(isOk).map((r) => r.value);
}

/**
 * Get all Err values from an array of Results.
 * Filters out Ok results and returns only the errors.
 */
export function filterErr<T, E>(results: Result<T, E>[]): E[] {
  return results.filter(isErr).map((r) => r.error);
}
