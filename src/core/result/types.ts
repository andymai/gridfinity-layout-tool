/**
 * Result<T, E> - Discriminated union for operations that can fail.
 *
 * This module provides a type-safe way to handle operations that can either
 * succeed with a value or fail with an error. Inspired by Rust's Result type
 * with TypeScript ergonomics.
 *
 * @example
 * ```ts
 * import { Result, ok, err, isOk } from '@/core/result';
 *
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err('Division by zero');
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log('Result:', result.value); // 5
 * }
 * ```
 */

/**
 * Success variant of Result.
 * Contains the successful value of type T.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Failure variant of Result.
 * Contains the error of type E.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok with a value or Err with an error.
 *
 * @template T - The type of the success value
 * @template E - The type of the error (defaults to Error)
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Type guard to check if a Result is Ok.
 * Narrows the type to Ok<T>.
 *
 * @example
 * ```ts
 * const result = loadUser(id);
 * if (isOk(result)) {
 *   // TypeScript knows result.value is available here
 *   console.log(result.value.name);
 * }
 * ```
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard to check if a Result is Err.
 * Narrows the type to Err<E>.
 *
 * @example
 * ```ts
 * const result = loadUser(id);
 * if (isErr(result)) {
 *   // TypeScript knows result.error is available here
 *   console.error(result.error.message);
 * }
 * ```
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Create a successful Result with a value.
 *
 * @example
 * ```ts
 * function findUser(id: string): Result<User, NotFoundError> {
 *   const user = users.get(id);
 *   if (user) return ok(user);
 *   return err(notFoundError(id));
 * }
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed Result with an error.
 *
 * @example
 * ```ts
 * function validateAge(age: number): Result<number, ValidationError> {
 *   if (age < 0) return err(validationError('Age cannot be negative'));
 *   return ok(age);
 * }
 * ```
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Unit type for operations that succeed without returning a value.
 * Use undefined to represent "no value" in Result context.
 */
export type Unit = undefined;

/**
 * Pre-constructed Ok result with no value.
 * Use this for operations that succeed without returning data.
 *
 * @example
 * ```ts
 * function deleteUser(id: string): Result<Unit, NotFoundError> {
 *   if (!users.has(id)) return err(notFoundError(id));
 *   users.delete(id);
 *   return OK;
 * }
 * ```
 */
export const OK: Ok<Unit> = ok(undefined);
