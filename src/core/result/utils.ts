/**
 * Utility functions for working with Result types.
 *
 * This module provides ergonomic helpers for:
 * - Transformations: map, mapErr, flatMap/andThen
 * - Extraction: unwrap, unwrapOr, unwrapOrElse
 * - Pattern matching: match
 * - Try-catch wrappers: tryCatch, tryCatchAsync
 *
 * These utilities are inspired by Rust's Result type and functional
 * programming patterns, adapted for TypeScript ergonomics.
 */

import type { Result } from './types';
import { ok, err, isOk, isErr } from './types';

// Mapping & Transformation

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
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
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
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
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

// Value Extraction

/**
 * Format an arbitrary error/value into a human-readable string for unwrap
 * panic messages. Errors use `.message` (their props aren't enumerable, so
 * JSON.stringify yields `{}`); plain objects are JSON-stringified with an
 * `[unserializable]` fallback for circular refs / BigInt. The original
 * value is preserved via `Error#cause` on the throw site.
 */
function formatErrorDetail(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null) return String(error);
  try {
    return JSON.stringify(error);
  } catch {
    return '[unserializable]';
  }
}

/**
 * Extract the Ok value, throwing if Err.
 * Use sparingly - prefer match() or isOk() checks.
 *
 * The thrown Error preserves the original error via `cause`, so structured
 * errors (e.g. AppError with a non-serializable cause) survive unwrap panics.
 *
 * @throws Error if Result is not Ok
 *
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrap(result); // 42
 *
 * try {
 *   unwrap(err(storageNotFound('key')));
 * } catch (e) {
 *   e.message; // "Called unwrap on an Err: ..."
 *   e.cause;   // original StorageNotFoundError
 * }
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Called unwrap on an Err: ${formatErrorDetail(result.error)}`, {
    cause: result.error,
  });
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
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  return isOk(result) ? result.value : fn(result.error);
}

/**
 * Extract the Err value, throwing if Ok.
 * Useful for testing error paths.
 *
 * The thrown Error preserves the original Ok value via `cause`.
 *
 * @throws Error if Result is Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error(`Called unwrapErr on an Ok: ${formatErrorDetail(result.value)}`, {
    cause: result.value,
  });
}

// Pattern Matching

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

// Try-Catch Wrappers

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
