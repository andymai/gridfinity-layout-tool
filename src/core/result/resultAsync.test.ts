import { describe, it, expect, vi } from 'vitest';
import { ok, err, isOk, isErr } from '@/core/result/types';
import type { Result } from '@/core/result/types';
import { ResultAsync } from '@/core/result/resultAsync';

// =============================================================================
// fromPromise
// =============================================================================

describe('ResultAsync.fromPromise()', () => {
  it('resolves to Ok when the promise resolves', async () => {
    const result = await ResultAsync.fromPromise(Promise.resolve(42), () => 'unused');
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('resolves to Err with mapped error when the promise rejects', async () => {
    const result = await ResultAsync.fromPromise(
      Promise.reject(new Error('boom')),
      (e) => `wrapped:${(e as Error).message}`
    );
    expect(result).toEqual({ ok: false, error: 'wrapped:boom' });
  });

  it('passes the rejection reason to mapError', async () => {
    const thrown = new TypeError('type mismatch');
    const seen: unknown[] = [];
    await ResultAsync.fromPromise(Promise.reject(thrown), (e) => {
      seen.push(e);
      return 'ok';
    });
    expect(seen[0]).toBe(thrown);
  });
});

// =============================================================================
// fromSafePromise
// =============================================================================

describe('ResultAsync.fromSafePromise()', () => {
  it('always resolves to Ok', async () => {
    const result = await ResultAsync.fromSafePromise(Promise.resolve('hi'));
    expect(result).toEqual({ ok: true, value: 'hi' });
  });
});

// =============================================================================
// fromResult
// =============================================================================

describe('ResultAsync.fromResult()', () => {
  it('lifts an Ok result', async () => {
    const result = await ResultAsync.fromResult(ok(1));
    expect(result).toEqual({ ok: true, value: 1 });
  });

  it('lifts an Err result', async () => {
    const result = await ResultAsync.fromResult(err('nope'));
    expect(result).toEqual({ ok: false, error: 'nope' });
  });
});

// =============================================================================
// map
// =============================================================================

describe('ResultAsync.map()', () => {
  it('transforms the Ok value with a sync function', async () => {
    const result = await ResultAsync.fromResult(ok(2)).map((x) => x * 5);
    expect(result).toEqual({ ok: true, value: 10 });
  });

  it('transforms the Ok value with an async function', async () => {
    const result = await ResultAsync.fromResult(ok(2)).map(async (x) => x * 5);
    expect(result).toEqual({ ok: true, value: 10 });
  });

  it('does not invoke the function on Err', async () => {
    const fn = vi.fn((x: number) => x + 1);
    const result = await ResultAsync.fromResult(err('e') as Result<number, string>).map(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'e' });
  });
});

// =============================================================================
// mapErr
// =============================================================================

describe('ResultAsync.mapErr()', () => {
  it('transforms the Err value', async () => {
    const result = await ResultAsync.fromResult(err('boom')).mapErr((e) => e.toUpperCase());
    expect(result).toEqual({ ok: false, error: 'BOOM' });
  });

  it('does not invoke the function on Ok', async () => {
    const fn = vi.fn((e: string) => e);
    const result = await ResultAsync.fromResult(ok(1) as Result<number, string>).mapErr(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: 1 });
  });
});

// =============================================================================
// andThen
// =============================================================================

describe('ResultAsync.andThen()', () => {
  it('chains a sync Result-returning function', async () => {
    const result = await ResultAsync.fromResult(ok(2)).andThen((x) => ok(x + 1));
    expect(result).toEqual({ ok: true, value: 3 });
  });

  it('chains a Promise<Result>-returning function', async () => {
    const result = await ResultAsync.fromResult(ok(2)).andThen(async (x) => ok(x + 1));
    expect(result).toEqual({ ok: true, value: 3 });
  });

  it('chains another ResultAsync', async () => {
    const result = await ResultAsync.fromResult(ok(2)).andThen((x) =>
      ResultAsync.fromResult(ok(x + 1))
    );
    expect(result).toEqual({ ok: true, value: 3 });
  });

  it('short-circuits without invoking fn when upstream is Err', async () => {
    const fn = vi.fn((x: number) => ok(x + 1));
    const result = await ResultAsync.fromResult(err('upstream') as Result<number, string>).andThen(
      fn
    );
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'upstream' });
  });

  it('propagates Err from the chained function', async () => {
    const result = await ResultAsync.fromResult(ok(2)).andThen(() => err('downstream'));
    expect(result).toEqual({ ok: false, error: 'downstream' });
  });

  it('composes a multi-step chain', async () => {
    const result = await ResultAsync.fromPromise(Promise.resolve(2), () => 'fetch-fail')
      .map((x) => x + 1)
      .andThen((x) => ok(x * 10))
      .map(async (x) => x.toString());
    expect(result).toEqual({ ok: true, value: '30' });
  });
});

// =============================================================================
// match
// =============================================================================

describe('ResultAsync.match()', () => {
  it('runs the ok handler and resolves to its return value', async () => {
    const value = await ResultAsync.fromResult(ok(7)).match({
      ok: (v) => `got ${v}`,
      err: () => 'never',
    });
    expect(value).toBe('got 7');
  });

  it('runs the err handler and resolves to its return value', async () => {
    const value = await ResultAsync.fromResult(err('oops')).match({
      ok: () => 'never',
      err: (e) => `bad: ${e}`,
    });
    expect(value).toBe('bad: oops');
  });
});

// =============================================================================
// unwrapOr
// =============================================================================

describe('ResultAsync.unwrapOr()', () => {
  it('resolves to the Ok value when Ok', async () => {
    expect(await ResultAsync.fromResult(ok(7)).unwrapOr(0)).toBe(7);
  });

  it('resolves to the default when Err', async () => {
    expect(await ResultAsync.fromResult(err('e') as Result<number, string>).unwrapOr(0)).toBe(0);
  });
});

// =============================================================================
// PromiseLike (await yields plain Result)
// =============================================================================

describe('ResultAsync as PromiseLike', () => {
  it('await yields a plain-object Result with discriminant ok=true', async () => {
    const result = await ResultAsync.fromResult(ok(1));
    expect(result).toEqual({ ok: true, value: 1 });
    expect(isOk(result)).toBe(true);
  });

  it('await yields a plain-object Result with discriminant ok=false', async () => {
    const result = await ResultAsync.fromResult(err('e'));
    expect(result).toEqual({ ok: false, error: 'e' });
    expect(isErr(result)).toBe(true);
  });

  it('the awaited result is a plain object (not a class instance)', async () => {
    const result = await ResultAsync.fromResult(ok(1));
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it('forwards rejections to the onrejected handler when used as PromiseLike', async () => {
    const seen: unknown[] = [];
    const thrown = new Error('throws-from-fn');
    await ResultAsync.fromResult(ok(1))
      .map(() => {
        throw thrown;
      })
      .then(
        () => undefined,
        (e: unknown) => {
          seen.push(e);
        }
      );
    expect(seen[0]).toBe(thrown);
  });
});

// =============================================================================
// Throw contract — `map`/`mapErr`/`andThen` callbacks must not throw.
// These tests assert (and document) that violating the contract surfaces
// as a rejected promise rather than being silently swallowed into Err.
// Fallible operations should enter the chain via `fromPromise`.
// =============================================================================

describe('ResultAsync — callback throw contract', () => {
  it('map: a synchronously-throwing callback rejects the chain', async () => {
    await expect(
      ResultAsync.fromResult(ok(1)).map(() => {
        throw new Error('sync-throw');
      })
    ).rejects.toThrow('sync-throw');
  });

  it('map: an async callback that rejects propagates the rejection', async () => {
    const thrown = new Error('async-throw');
    await expect(
      ResultAsync.fromResult(ok(1)).map(async () => Promise.reject(thrown))
    ).rejects.toBe(thrown);
  });

  it('mapErr: a throwing callback rejects the chain', async () => {
    await expect(
      ResultAsync.fromResult(err('e')).mapErr(() => {
        throw new Error('mapErr-throw');
      })
    ).rejects.toThrow('mapErr-throw');
  });

  it('andThen: a callback returning a rejecting Promise<Result> propagates', async () => {
    await expect(
      ResultAsync.fromResult(ok(1)).andThen(
        (): Promise<Result<number, string>> => Promise.reject(new Error('andThen-throw'))
      )
    ).rejects.toThrow('andThen-throw');
  });

  it('andThen: a callback returning a ResultAsync over a rejecting promise propagates', async () => {
    const downstream = ResultAsync.fromPromise<number, string>(
      Promise.reject(new Error('downstream-failed')),
      (e) => `wrapped:${(e as Error).message}`
    );
    // fromPromise *does* catch — so this resolves to Err, not reject.
    const result = await ResultAsync.fromResult(ok(1)).andThen(() => downstream);
    expect(result).toEqual({ ok: false, error: 'wrapped:downstream-failed' });
  });
});

// =============================================================================
// andThen — error-type union widening
// =============================================================================

describe('ResultAsync.andThen() — error union widening', () => {
  it('widens the error type to E | F when the chained fn returns a different Err type', async () => {
    type ErrA = { kind: 'a'; code: 'A1' };
    type ErrB = { kind: 'b'; code: 'B1' };

    const start: ResultAsync<number, ErrA> = ResultAsync.fromResult(ok<number, ErrA>(1));
    const chained = start.andThen<string, ErrB>((x) => ok<string, ErrB>(String(x)));

    // Type-level: chained is ResultAsync<string, ErrA | ErrB>.
    // Runtime: just verify the happy path resolves.
    const result = await chained;
    expect(result).toEqual({ ok: true, value: '1' });
  });

  it('preserves the upstream Err when the chained fn would have widened the type', async () => {
    type ErrA = { kind: 'a'; code: 'A1' };
    type ErrB = { kind: 'b'; code: 'B1' };

    const upstream: ErrA = { kind: 'a', code: 'A1' };
    const start: ResultAsync<number, ErrA> = ResultAsync.fromResult(err<ErrA>(upstream));
    const fn = vi.fn((x: number) => ok<string, ErrB>(String(x)));

    const result = await start.andThen<string, ErrB>(fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: upstream });
  });
});
