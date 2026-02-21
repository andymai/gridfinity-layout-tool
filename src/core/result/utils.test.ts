import { describe, it, expect, vi } from 'vitest';
import { ok, err, isOk, isErr } from '@/core/result/types';
import type { Result } from '@/core/result/types';
import {
  map,
  mapErr,
  flatMap,
  andThen,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  unwrapErr,
  match,
  tryCatch,
  tryCatchAsync,
} from '@/core/result/utils';

// =============================================================================
// map
// =============================================================================

describe('map()', () => {
  it('transforms the Ok value using the provided function', () => {
    const result = map(ok(5), (x) => x * 2);
    expect(result).toEqual({ ok: true, value: 10 });
  });

  it('passes an Err through unchanged without calling the function', () => {
    const fn = vi.fn(() => 0);
    const result = map(err('original') as Result<number, string>, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'original' });
  });

  it('can map to a different type', () => {
    const result = map(ok(42), (n) => String(n));
    expect(result).toEqual({ ok: true, value: '42' });
  });

  it('handles falsy mapped values — null', () => {
    const result = map(ok(1), () => null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it('handles falsy mapped values — zero', () => {
    const result = map(ok(1), () => 0);
    expect(result).toEqual({ ok: true, value: 0 });
  });

  it('handles falsy mapped values — false', () => {
    const result = map(ok(1), () => false);
    expect(result).toEqual({ ok: true, value: false });
  });

  it('handles falsy mapped values — empty string', () => {
    const result = map(ok(1), () => '');
    expect(result).toEqual({ ok: true, value: '' });
  });

  it('maps to a complex object', () => {
    const result = map(ok('hello'), (s) => ({ length: s.length, upper: s.toUpperCase() }));
    expect(result).toEqual({ ok: true, value: { length: 5, upper: 'HELLO' } });
  });

  it('preserves the original Err value identity (no copy)', () => {
    const error = { code: 'E', detail: 'detail' };
    const input = err(error) as Result<number, typeof error>;
    const output = map(input, (x) => x + 1);
    expect(isErr(output) && output.error).toBe(error);
  });
});

// =============================================================================
// mapErr
// =============================================================================

describe('mapErr()', () => {
  it('transforms the Err value using the provided function', () => {
    const result = mapErr(err('error'), (e) => e.toUpperCase());
    expect(result).toEqual({ ok: false, error: 'ERROR' });
  });

  it('passes an Ok through unchanged without calling the function', () => {
    const fn = vi.fn(() => 'transformed');
    const result = mapErr(ok(42) as Result<number, string>, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('can map to a completely different error type', () => {
    const result = mapErr(err('network failure') as Result<number, string>, (e) => ({
      message: e,
      code: 500,
    }));
    expect(result).toEqual({ ok: false, error: { message: 'network failure', code: 500 } });
  });

  it('handles falsy mapped error values — zero', () => {
    const result = mapErr(err('any') as Result<number, string>, () => 0);
    expect(result).toEqual({ ok: false, error: 0 });
  });

  it('preserves the original Ok value identity (no copy)', () => {
    const value = { id: '1' };
    const input = ok(value) as Result<typeof value, string>;
    const output = mapErr(input, () => 'mapped');
    expect(isOk(output) && output.value).toBe(value);
  });
});

// =============================================================================
// flatMap
// =============================================================================

describe('flatMap()', () => {
  const divide = (a: number, b: number): Result<number, string> =>
    b === 0 ? err('Division by zero') : ok(a / b);

  it('chains an Ok result through the function', () => {
    const result = flatMap(ok(10), (x) => divide(x, 2));
    expect(result).toEqual({ ok: true, value: 5 });
  });

  it('short-circuits when the function returns Err', () => {
    const result = flatMap(ok(10), (x) => divide(x, 0));
    expect(result).toEqual({ ok: false, error: 'Division by zero' });
  });

  it('does not call the function when input is Err', () => {
    const fn = vi.fn(() => ok(0));
    const result = flatMap(err('upstream') as Result<number, string>, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'upstream' });
  });

  it('passes the Ok value to the function', () => {
    const received: number[] = [];
    flatMap(ok(99), (x) => {
      received.push(x);
      return ok(x);
    });
    expect(received).toEqual([99]);
  });

  it('chains multiple steps — all succeed', () => {
    const step1 = (n: number): Result<number, string> => ok(n + 1);
    const step2 = (n: number): Result<string, string> => ok(`value:${n}`);

    const result = flatMap(flatMap(ok(0), step1), step2);
    expect(result).toEqual({ ok: true, value: 'value:1' });
  });

  it('chains multiple steps — first fails, second is skipped', () => {
    const step1 = (_n: number): Result<number, string> => err('step1 failed');
    const step2 = vi.fn((_n: number): Result<string, string> => ok('step2'));

    const result = flatMap(flatMap(ok(0), step1), step2);
    expect(step2).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'step1 failed' });
  });

  it('propagates an input Err through multiple chained calls', () => {
    const fn1 = vi.fn(() => ok(1));
    const fn2 = vi.fn(() => ok(2));

    const base = err('original') as Result<number, string>;
    const result = flatMap(flatMap(base, fn1), fn2);

    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'original' });
  });
});

// =============================================================================
// andThen
// =============================================================================

describe('andThen()', () => {
  it('is the same function reference as flatMap', () => {
    expect(andThen).toBe(flatMap);
  });

  it('chains an Ok result exactly like flatMap', () => {
    const double = (x: number): Result<number, string> => ok(x * 2);
    expect(andThen(ok(5), double)).toEqual({ ok: true, value: 10 });
  });

  it('short-circuits on Err exactly like flatMap', () => {
    const fn = vi.fn(() => ok(0));
    const result = andThen(err('fail') as Result<number, string>, fn);
    expect(fn).not.toHaveBeenCalled();
    expect(isErr(result)).toBe(true);
  });
});

// =============================================================================
// unwrap
// =============================================================================

describe('unwrap()', () => {
  it('returns the value from an Ok result', () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  it('returns complex objects without modification', () => {
    const value = { a: 1, b: [2, 3] };
    expect(unwrap(ok(value))).toBe(value);
  });

  it('returns falsy values correctly — zero', () => {
    expect(unwrap(ok(0))).toBe(0);
  });

  it('returns falsy values correctly — false', () => {
    expect(unwrap(ok(false))).toBe(false);
  });

  it('returns falsy values correctly — null', () => {
    expect(unwrap(ok(null))).toBeNull();
  });

  it('returns falsy values correctly — empty string', () => {
    expect(unwrap(ok(''))).toBe('');
  });

  it('throws an Error when called on an Err', () => {
    expect(() => unwrap(err('something failed'))).toThrow(Error);
  });

  it('includes "Called unwrap on an Err" in the thrown message', () => {
    expect(() => unwrap(err('oops'))).toThrow('Called unwrap on an Err');
  });

  it('includes a JSON representation of the error in the thrown message', () => {
    expect(() => unwrap(err({ code: 'E_FAIL' }))).toThrow('"code":"E_FAIL"');
  });

  it('throws for Err with primitive error value', () => {
    expect(() => unwrap(err(404))).toThrow('404');
  });
});

// =============================================================================
// unwrapOr
// =============================================================================

describe('unwrapOr()', () => {
  it('returns the Ok value when the result is Ok', () => {
    expect(unwrapOr(ok(42), 0)).toBe(42);
  });

  it('returns the default value when the result is Err', () => {
    expect(unwrapOr(err('error') as Result<number, string>, 0)).toBe(0);
  });

  it('returns falsy Ok values — zero — not the default', () => {
    expect(unwrapOr(ok(0), 99)).toBe(0);
  });

  it('returns falsy Ok values — false — not the default', () => {
    expect(unwrapOr(ok(false), true)).toBe(false);
  });

  it('returns the default without calling any function', () => {
    const defaultVal = { id: 'default' };
    const result = unwrapOr(err('error') as Result<typeof defaultVal, string>, defaultVal);
    expect(result).toBe(defaultVal);
  });

  it('returns the default as null when specified', () => {
    const result = unwrapOr(err('error') as Result<null, string>, null);
    expect(result).toBeNull();
  });
});

// =============================================================================
// unwrapOrElse
// =============================================================================

describe('unwrapOrElse()', () => {
  it('returns the Ok value without calling the function', () => {
    const fn = vi.fn(() => 0);
    const result = unwrapOrElse(ok(42), fn);
    expect(fn).not.toHaveBeenCalled();
    expect(result).toBe(42);
  });

  it('calls the function with the error and returns its result', () => {
    const result = unwrapOrElse(
      err({ defaultValue: 99 }) as Result<number, { defaultValue: number }>,
      (e) => e.defaultValue
    );
    expect(result).toBe(99);
  });

  it('passes the exact error value to the function', () => {
    const error = { code: 'E', detail: 'detail' };
    const received: (typeof error)[] = [];
    unwrapOrElse(err(error) as Result<number, typeof error>, (e) => {
      received.push(e);
      return 0;
    });
    expect(received[0]).toBe(error);
  });

  it('can derive a complex default from the error', () => {
    const result = unwrapOrElse(
      err('NOT_FOUND') as Result<string, string>,
      (code) => `fallback for ${code}`
    );
    expect(result).toBe('fallback for NOT_FOUND');
  });

  it('handles a function that returns a falsy value — zero', () => {
    expect(unwrapOrElse(err('any') as Result<number, string>, () => 0)).toBe(0);
  });

  it('handles falsy Ok values — false — without calling the function', () => {
    const fn = vi.fn(() => true);
    expect(unwrapOrElse(ok(false), fn)).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

// =============================================================================
// unwrapErr
// =============================================================================

describe('unwrapErr()', () => {
  it('returns the error from an Err result', () => {
    expect(unwrapErr(err('error'))).toBe('error');
  });

  it('returns complex error objects without modification', () => {
    const error = { code: 'E_FAIL', detail: 'oops' };
    expect(unwrapErr(err(error))).toBe(error);
  });

  it('throws an Error when called on an Ok result', () => {
    expect(() => unwrapErr(ok(42))).toThrow(Error);
  });

  it('includes "Called unwrapErr on an Ok" in the thrown message', () => {
    expect(() => unwrapErr(ok(42))).toThrow('Called unwrapErr on an Ok');
  });

  it('includes a JSON representation of the Ok value in the thrown message', () => {
    expect(() => unwrapErr(ok({ id: 'abc' }))).toThrow('"id":"abc"');
  });

  it('throws for Ok with falsy values — zero', () => {
    expect(() => unwrapErr(ok(0))).toThrow('Called unwrapErr on an Ok');
  });

  it('throws for Ok with falsy values — false', () => {
    expect(() => unwrapErr(ok(false))).toThrow('Called unwrapErr on an Ok');
  });

  it('throws for Ok with null value', () => {
    expect(() => unwrapErr(ok(null))).toThrow('Called unwrapErr on an Ok');
  });
});

// =============================================================================
// match
// =============================================================================

describe('match()', () => {
  it('calls the ok handler for an Ok result and returns its value', () => {
    const result = match(ok(42), {
      ok: (v) => `Value: ${v}`,
      err: (e) => `Error: ${e}`,
    });
    expect(result).toBe('Value: 42');
  });

  it('calls the err handler for an Err result and returns its value', () => {
    const result = match(err('failed') as Result<number, string>, {
      ok: (v) => `Value: ${v}`,
      err: (e) => `Error: ${e}`,
    });
    expect(result).toBe('Error: failed');
  });

  it('does not call the err handler when result is Ok', () => {
    const errHandler = vi.fn(() => 'err');
    match(ok(1), { ok: () => 'ok', err: errHandler });
    expect(errHandler).not.toHaveBeenCalled();
  });

  it('does not call the ok handler when result is Err', () => {
    const okHandler = vi.fn(() => 'ok');
    match(err('e') as Result<number, string>, { ok: okHandler, err: () => 'err' });
    expect(okHandler).not.toHaveBeenCalled();
  });

  it('passes the exact Ok value to the ok handler', () => {
    const value = { id: 'abc' };
    const received: (typeof value)[] = [];
    match(ok(value), {
      ok: (v) => {
        received.push(v);
        return null;
      },
      err: () => null,
    });
    expect(received[0]).toBe(value);
  });

  it('passes the exact Err value to the err handler', () => {
    const error = { code: 'E_FAIL' };
    const received: (typeof error)[] = [];
    match(err(error) as Result<number, typeof error>, {
      ok: () => null,
      err: (e) => {
        received.push(e);
        return null;
      },
    });
    expect(received[0]).toBe(error);
  });

  it('can return non-string types — numbers', () => {
    const result = match(ok('hello'), {
      ok: (s) => s.length,
      err: () => -1,
    });
    expect(result).toBe(5);
  });

  it('can return non-string types — objects', () => {
    const result = match(ok(1) as Result<number, string>, {
      ok: (n) => ({ doubled: n * 2 }),
      err: () => ({ doubled: 0 }),
    });
    expect(result).toEqual({ doubled: 2 });
  });

  it('can return a Result itself from a handler', () => {
    const inner = match(ok(5) as Result<number, string>, {
      ok: (n) => ok(n * 10),
      err: (e) => err(e),
    });
    expect(inner).toEqual({ ok: true, value: 50 });
  });

  it('handlers are each called exactly once', () => {
    const okHandler = vi.fn(() => 'ok');
    const errHandler = vi.fn(() => 'err');
    match(ok(1), { ok: okHandler, err: errHandler });
    expect(okHandler).toHaveBeenCalledTimes(1);
    expect(errHandler).toHaveBeenCalledTimes(0);
  });
});

// =============================================================================
// tryCatch
// =============================================================================

describe('tryCatch()', () => {
  it('wraps a successful return value in Ok', () => {
    const result = tryCatch(() => 42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('wraps a successful JSON.parse in Ok', () => {
    const result = tryCatch(() => JSON.parse('{"a":1}'));
    expect(isOk(result)).toBe(true);
    expect(unwrap(result)).toEqual({ a: 1 });
  });

  it('returns Err with the raw thrown Error when no mapError is provided', () => {
    const thrown = new Error('parse failed');
    const result = tryCatch(() => {
      throw thrown;
    });
    expect(isErr(result)).toBe(true);
    // Without mapError the raw error is cast as E
    if (isErr(result)) {
      expect(result.error).toBe(thrown);
    }
  });

  it('applies mapError to the thrown value when provided', () => {
    const result = tryCatch(
      () => JSON.parse('invalid json'),
      () => 'PARSE_ERROR'
    );
    expect(result).toEqual({ ok: false, error: 'PARSE_ERROR' });
  });

  it('passes the thrown error to mapError', () => {
    const received: unknown[] = [];
    const thrown = new TypeError('bad input');
    tryCatch(
      () => {
        throw thrown;
      },
      (e) => {
        received.push(e);
        return 'mapped';
      }
    );
    expect(received[0]).toBe(thrown);
  });

  it('mapError can inspect the thrown value to build a structured error', () => {
    const result = tryCatch(
      () => {
        throw new Error('original');
      },
      (e) => ({ message: String(e), code: 'ERR' })
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('ERR');
    }
  });

  it('handles functions that return falsy — zero — as Ok', () => {
    expect(tryCatch(() => 0)).toEqual({ ok: true, value: 0 });
  });

  it('handles functions that return falsy — false — as Ok', () => {
    expect(tryCatch(() => false)).toEqual({ ok: true, value: false });
  });

  it('handles functions that return falsy — null — as Ok', () => {
    expect(tryCatch(() => null)).toEqual({ ok: true, value: null });
  });

  it('handles functions that return falsy — empty string — as Ok', () => {
    expect(tryCatch(() => '')).toEqual({ ok: true, value: '' });
  });

  it('handles non-Error thrown values (strings)', () => {
    const result = tryCatch(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing non-Error thrown values
      throw 'string error';
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe('string error');
    }
  });

  it('handles non-Error thrown values (objects)', () => {
    const obj = { code: 42 };
    const result = tryCatch(
      () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing non-Error thrown values
        throw obj;
      },
      (e) => e
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe(obj);
    }
  });
});

// =============================================================================
// tryCatchAsync
// =============================================================================

describe('tryCatchAsync()', () => {
  it('wraps a resolved promise value in Ok', async () => {
    const result = await tryCatchAsync(async () => 42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('wraps a successful async operation in Ok', async () => {
    const result = await tryCatchAsync(async () => ({ data: 'hello' }));
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ data: 'hello' });
    }
  });

  it('returns Err with the raw rejection when no mapError is provided', async () => {
    const thrown = new Error('network error');
    const result = await tryCatchAsync(async () => {
      throw thrown;
    });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe(thrown);
    }
  });

  it('applies mapError to a rejected promise', async () => {
    const result = await tryCatchAsync(
      async () => {
        throw new Error('async error');
      },
      () => 'ASYNC_ERROR'
    );
    expect(result).toEqual({ ok: false, error: 'ASYNC_ERROR' });
  });

  it('passes the rejection reason to mapError', async () => {
    const thrown = new TypeError('type mismatch');
    const received: unknown[] = [];
    await tryCatchAsync(
      async () => {
        throw thrown;
      },
      (e) => {
        received.push(e);
        return 'handled';
      }
    );
    expect(received[0]).toBe(thrown);
  });

  it('mapError can build a structured error from the rejection', async () => {
    const result = await tryCatchAsync(
      async () => {
        throw new Error('upstream');
      },
      (e) => ({ message: String(e), code: 'ASYNC_ERR' })
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('ASYNC_ERR');
    }
  });

  it('handles falsy resolved values — zero — as Ok', async () => {
    expect(await tryCatchAsync(async () => 0)).toEqual({ ok: true, value: 0 });
  });

  it('handles falsy resolved values — false — as Ok', async () => {
    expect(await tryCatchAsync(async () => false)).toEqual({ ok: true, value: false });
  });

  it('handles falsy resolved values — null — as Ok', async () => {
    expect(await tryCatchAsync(async () => null)).toEqual({ ok: true, value: null });
  });

  it('handles non-Error thrown values (strings)', async () => {
    const result = await tryCatchAsync(
      async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing non-Error thrown values
        throw 'string rejection';
      },
      (e) => e
    );
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toBe('string rejection');
    }
  });

  it('returns a Promise<Result>', async () => {
    const promise = tryCatchAsync(async () => 1);
    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(isOk(result)).toBe(true);
  });
});
