/**
 * ResultAsync<T, E> — chainable wrapper for `Promise<Result<T, E>>`.
 *
 * Lets you compose async Result-returning operations without
 * intermediate `await`/re-wrap. Awaiting a ResultAsync yields a
 * plain-object `Result<T, E>` (the canonical encoding used everywhere
 * else in this app — preserves serialization across web workers,
 * IndexedDB, and Liveblocks).
 *
 * **Throw contract:** `map`/`mapErr`/`andThen` callbacks must not throw
 * or return rejecting promises. If they do, the rejection escapes the
 * Result domain and `await` will throw. Use `fromPromise` to enter the
 * Result domain from any throwing source.
 *
 * @example
 * ```ts
 * const result = await ResultAsync.fromPromise(fetch(url), apiNetworkError)
 *   .andThen(parseJson)
 *   .andThen(validateShape)
 *   .map(extractPayload);
 *
 * if (isOk(result)) render(result.value);
 * else toast(getUserMessage(result.error));
 * ```
 */

import type { Result } from './types';
import { ok, err, isOk, isErr } from './types';
import { match, unwrapOr } from './utils';

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  private readonly promise: Promise<Result<T, E>>;

  constructor(promise: Promise<Result<T, E>>) {
    this.promise = promise;
  }

  /**
   * Lift a throwing promise into a ResultAsync. Rejections are caught and
   * funneled through `mapError` to produce an Err.
   *
   * Differs from `tryCatchAsync` in two ways:
   * - **Eager**: takes a `Promise<T>` (already-started); `tryCatchAsync` takes
   *   a `() => Promise<T>` thunk and starts it inside try/catch.
   * - **Required mapper**: `mapError` is required (not optional) so the Err
   *   type is always explicit. This is the chaining entry point.
   */
  static fromPromise<T, E>(
    promise: Promise<T>,
    mapError: (error: unknown) => E
  ): ResultAsync<T, E> {
    return new ResultAsync(
      promise.then<Result<T, E>, Result<T, E>>(
        (value) => ok(value),
        (error: unknown) => err(mapError(error))
      )
    );
  }

  /**
   * Lift a promise that is guaranteed not to reject. If the contract is
   * violated and the promise rejects, the rejection escapes — use
   * `fromPromise` if you can't prove the promise won't reject.
   */
  static fromSafePromise<T, E = never>(promise: Promise<T>): ResultAsync<T, E> {
    return new ResultAsync(promise.then<Result<T, E>>((value) => ok(value)));
  }

  /** Lift a sync Result into the async chain. */
  static fromResult<T, E>(result: Result<T, E>): ResultAsync<T, E> {
    return new ResultAsync(Promise.resolve(result));
  }

  /**
   * Transform the Ok value (sync or async) while preserving Err.
   * Callback must not throw or return a rejecting promise — see throw
   * contract on the class docblock. Use `andThen` with `fromPromise` to
   * convert a fallible async operation into a Result.
   *
   * The Err short-circuit is sync (no extra microtask) so chains that
   * propagate a single Err through many `map` calls don't accumulate
   * microtask hops.
   */
  map<U>(fn: (value: T) => U | Promise<U>): ResultAsync<U, E> {
    return new ResultAsync(
      this.promise.then((r): Result<U, E> | Promise<Result<U, E>> => {
        if (isErr(r)) return r;
        const next = fn(r.value);
        return next instanceof Promise ? next.then(ok) : ok(next);
      })
    );
  }

  /**
   * Transform the Err value (sync or async) while preserving Ok.
   * Callback must not throw or return a rejecting promise — see throw
   * contract on the class docblock. Ok short-circuits synchronously.
   */
  mapErr<F>(fn: (error: E) => F | Promise<F>): ResultAsync<T, F> {
    return new ResultAsync(
      this.promise.then((r): Result<T, F> | Promise<Result<T, F>> => {
        if (isOk(r)) return r;
        const next = fn(r.error);
        return next instanceof Promise ? next.then(err) : err(next);
      })
    );
  }

  /**
   * Chain another Result-returning operation. The follow-up may return
   * a sync Result, a Promise<Result>, or another ResultAsync. Callback
   * must not throw or return a rejecting promise — wrap fallible work in
   * `fromPromise` first.
   */
  andThen<U, F = E>(
    fn: (value: T) => Result<U, F> | ResultAsync<U, F> | Promise<Result<U, F>>
  ): ResultAsync<U, E | F> {
    return new ResultAsync(
      this.promise.then((r): Result<U, E | F> | Promise<Result<U, E | F>> => {
        if (isErr(r)) return r;
        const next = fn(r.value);
        // Fast path: unwrap a known ResultAsync to skip a `.then` hop.
        // Across split bundles or `vi.isolateModules` boundaries this check
        // can yield false even for genuine ResultAsync values; the slow path
        // below still works correctly because Promise.then accepts PromiseLike.
        if (next instanceof ResultAsync) return next.promise;
        return next;
      })
    );
  }

  /** Pattern-match terminal — resolves to the handler's return type. */
  match<U>(handlers: { ok: (value: T) => U; err: (error: E) => U }): Promise<U> {
    return this.promise.then((r) => match(r, handlers));
  }

  /** Resolve to the Ok value, or to `defaultValue` if Err. */
  unwrapOr(defaultValue: T): Promise<T> {
    return this.promise.then((r) => unwrapOr(r, defaultValue));
  }

  /**
   * PromiseLike implementation — `await rA` yields a plain `Result<T, E>`.
   * Returns `PromiseLike` (not `Promise`) so the runtime won't double-wrap
   * when this appears inside another `then` chain.
   */
  then<R1 = Result<T, E>, R2 = never>(
    onfulfilled?: ((value: Result<T, E>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.promise.then(onfulfilled, onrejected);
  }
}
