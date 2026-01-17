import { describe, it, expect } from 'vitest';
import {
  // Core types and constructors
  ok,
  err,
  isOk,
  isErr,
  OK,

  // Utility functions
  map,
  mapErr,
  flatMap,
  andThen,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  unwrapErr,
  match,
  combine,
  combine3,
  collect,
  collectAll,
  or,
  and,
  tryCatch,
  tryCatchAsync,
  toUnit,
  tap,
  tapErr,
  allOk,
  anyErr,
  filterOk,
  filterErr,

  // Error constructors
  storageNotFound,
  storageQuotaExceeded,
  storageCorrupted,
  validationCollision,
  validationOutOfBounds,
  layoutLayerLimit,
  layoutLastEntity,
  apiRateLimited,
  apiNetworkError,
  unknownError,
  fromUnknown,

  // Catalog functions
  getErrorInfo,
  getUserMessage,
  getRecoveryHint,
  formatErrorMessage,
  isRetryable,
  getSeverity,
} from '../core/result';
import type { Result, StorageError, ValidationError } from '../core/result';

// =============================================================================
// Core Type Tests
// =============================================================================

describe('Result core types', () => {
  describe('ok()', () => {
    it('creates a successful result with a value', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('creates a successful result with complex objects', () => {
      const user = { id: '1', name: 'Test' };
      const result = ok(user);
      expect(result).toEqual({ ok: true, value: user });
    });

    it('creates a successful result with undefined', () => {
      const result = ok(undefined);
      expect(result).toEqual({ ok: true, value: undefined });
    });
  });

  describe('err()', () => {
    it('creates a failed result with an error', () => {
      const result = err('something went wrong');
      expect(result).toEqual({ ok: false, error: 'something went wrong' });
    });

    it('creates a failed result with structured error', () => {
      const error = { code: 'NOT_FOUND', message: 'Not found' };
      const result = err(error);
      expect(result).toEqual({ ok: false, error });
    });
  });

  describe('isOk()', () => {
    it('returns true for ok results', () => {
      expect(isOk(ok(42))).toBe(true);
    });

    it('returns false for err results', () => {
      expect(isOk(err('error'))).toBe(false);
    });

    it('narrows type correctly', () => {
      const result: Result<number, string> = ok(42);
      if (isOk(result)) {
        // TypeScript should know result.value is number
        expect(result.value).toBe(42);
      }
    });
  });

  describe('isErr()', () => {
    it('returns true for err results', () => {
      expect(isErr(err('error'))).toBe(true);
    });

    it('returns false for ok results', () => {
      expect(isErr(ok(42))).toBe(false);
    });

    it('narrows type correctly', () => {
      const result: Result<number, string> = err('error');
      if (isErr(result)) {
        // TypeScript should know result.error is string
        expect(result.error).toBe('error');
      }
    });
  });

  describe('OK constant', () => {
    it('is a pre-constructed Ok<void>', () => {
      expect(OK).toEqual({ ok: true, value: undefined });
    });
  });
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Result utilities', () => {
  describe('map()', () => {
    it('transforms ok value', () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(mapped).toEqual({ ok: true, value: 10 });
    });

    it('preserves err without calling function', () => {
      const result = err('error') as Result<number, string>;
      let called = false;
      const mapped = map(result, () => {
        called = true;
        return 0;
      });
      expect(called).toBe(false);
      expect(mapped).toEqual({ ok: false, error: 'error' });
    });
  });

  describe('mapErr()', () => {
    it('transforms err value', () => {
      const result = err('error');
      const mapped = mapErr(result, (e) => e.toUpperCase());
      expect(mapped).toEqual({ ok: false, error: 'ERROR' });
    });

    it('preserves ok without calling function', () => {
      const result = ok(42) as Result<number, string>;
      let called = false;
      const mapped = mapErr(result, () => {
        called = true;
        return 'transformed';
      });
      expect(called).toBe(false);
      expect(mapped).toEqual({ ok: true, value: 42 });
    });
  });

  describe('flatMap() / andThen()', () => {
    it('chains successful results', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('Division by zero') : ok(a / b);

      const result = flatMap(ok(10), (x) => divide(x, 2));
      expect(result).toEqual({ ok: true, value: 5 });
    });

    it('short-circuits on error', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('Division by zero') : ok(a / b);

      const result = flatMap(ok(10), (x) => divide(x, 0));
      expect(result).toEqual({ ok: false, error: 'Division by zero' });
    });

    it('does not call function on err input', () => {
      let called = false;
      const result = flatMap(err('error') as Result<number, string>, () => {
        called = true;
        return ok(0);
      });
      expect(called).toBe(false);
      expect(isErr(result)).toBe(true);
    });

    it('andThen is an alias for flatMap', () => {
      expect(andThen).toBe(flatMap);
    });
  });

  describe('unwrap()', () => {
    it('returns value from ok result', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('throws on err result', () => {
      expect(() => unwrap(err('error'))).toThrow('Called unwrap on an Err');
    });
  });

  describe('unwrapOr()', () => {
    it('returns value from ok result', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('returns default for err result', () => {
      expect(unwrapOr(err('error') as Result<number, string>, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse()', () => {
    it('returns value from ok result', () => {
      const result = unwrapOrElse(ok(42), () => 0);
      expect(result).toBe(42);
    });

    it('computes default from error', () => {
      const result = unwrapOrElse(
        err({ defaultValue: 99 }) as Result<number, { defaultValue: number }>,
        (e) => e.defaultValue
      );
      expect(result).toBe(99);
    });
  });

  describe('unwrapErr()', () => {
    it('returns error from err result', () => {
      expect(unwrapErr(err('error'))).toBe('error');
    });

    it('throws on ok result', () => {
      expect(() => unwrapErr(ok(42))).toThrow('Called unwrapErr on an Ok');
    });
  });

  describe('match()', () => {
    it('calls ok handler for ok result', () => {
      const message = match(ok(42), {
        ok: (v) => `Value: ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(message).toBe('Value: 42');
    });

    it('calls err handler for err result', () => {
      const message = match(err('failed'), {
        ok: (v) => `Value: ${v}`,
        err: (e) => `Error: ${e}`,
      });
      expect(message).toBe('Error: failed');
    });
  });

  describe('combine()', () => {
    it('combines two ok results into tuple', () => {
      const result = combine(ok(1), ok('hello'));
      expect(result).toEqual({ ok: true, value: [1, 'hello'] });
    });

    it('returns first error if first is err', () => {
      const result = combine(err('first'), ok('hello'));
      expect(result).toEqual({ ok: false, error: 'first' });
    });

    it('returns second error if second is err', () => {
      const result = combine(ok(1), err('second'));
      expect(result).toEqual({ ok: false, error: 'second' });
    });
  });

  describe('combine3()', () => {
    it('combines three ok results into tuple', () => {
      const result = combine3(ok(1), ok('hello'), ok(true));
      expect(result).toEqual({ ok: true, value: [1, 'hello', true] });
    });

    it('returns first error encountered', () => {
      const result = combine3(ok(1), err('second'), err('third'));
      expect(result).toEqual({ ok: false, error: 'second' });
    });
  });

  describe('collect()', () => {
    it('collects all ok values into array', () => {
      const results = [ok(1), ok(2), ok(3)];
      const collected = collect(results);
      expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it('returns first error', () => {
      const results = [ok(1), err('error'), ok(3)];
      const collected = collect(results);
      expect(collected).toEqual({ ok: false, error: 'error' });
    });

    it('handles empty array', () => {
      const collected = collect([]);
      expect(collected).toEqual({ ok: true, value: [] });
    });
  });

  describe('collectAll()', () => {
    it('collects all ok values when no errors', () => {
      const results = [ok(1), ok(2), ok(3)];
      const collected = collectAll(results);
      expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it('collects all errors when some fail', () => {
      const results = [ok(1), err('a'), ok(2), err('b')];
      const collected = collectAll(results);
      expect(collected).toEqual({ ok: false, error: ['a', 'b'] });
    });
  });

  describe('or()', () => {
    it('returns first ok', () => {
      const result = or(ok(1), ok(2));
      expect(result).toEqual({ ok: true, value: 1 });
    });

    it('returns second if first is err', () => {
      const result = or(err('first') as Result<number, string>, ok(2));
      expect(result).toEqual({ ok: true, value: 2 });
    });

    it('returns last err if both fail', () => {
      const result = or(err('first'), err('second'));
      expect(result).toEqual({ ok: false, error: 'second' });
    });
  });

  describe('and()', () => {
    it('returns second if first is ok', () => {
      const result = and(ok(1), ok('hello'));
      expect(result).toEqual({ ok: true, value: 'hello' });
    });

    it('returns first error if first is err', () => {
      const result = and(err('first'), ok('hello'));
      expect(result).toEqual({ ok: false, error: 'first' });
    });
  });

  describe('tryCatch()', () => {
    it('returns ok for successful function', () => {
      const result = tryCatch(() => JSON.parse('{"a": 1}'));
      expect(isOk(result)).toBe(true);
      expect(unwrap(result)).toEqual({ a: 1 });
    });

    it('returns err for throwing function', () => {
      const result = tryCatch(() => JSON.parse('invalid'));
      expect(isErr(result)).toBe(true);
    });

    it('maps error with provided function', () => {
      const result = tryCatch(
        () => JSON.parse('invalid'),
        () => 'PARSE_ERROR'
      );
      expect(result).toEqual({ ok: false, error: 'PARSE_ERROR' });
    });
  });

  describe('tryCatchAsync()', () => {
    it('returns ok for successful async function', async () => {
      const result = await tryCatchAsync(async () => 42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('returns err for rejecting async function', async () => {
      const result = await tryCatchAsync(
        async () => {
          throw new Error('async error');
        },
        () => 'ASYNC_ERROR'
      );
      expect(result).toEqual({ ok: false, error: 'ASYNC_ERROR' });
    });
  });

  describe('toUnit()', () => {
    it('converts ok to ok<void>', () => {
      const result = toUnit(ok(42));
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('preserves err', () => {
      const result = toUnit(err('error'));
      expect(result).toEqual({ ok: false, error: 'error' });
    });
  });

  describe('tap()', () => {
    it('calls function for ok and returns original', () => {
      let captured = 0;
      const original = ok(42);
      const result = tap(original, (v) => {
        captured = v;
      });
      expect(captured).toBe(42);
      expect(result).toBe(original);
    });

    it('does not call function for err', () => {
      let called = false;
      const result = tap(err('error'), () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('tapErr()', () => {
    it('calls function for err and returns original', () => {
      let captured = '';
      const original = err('error');
      const result = tapErr(original, (e) => {
        captured = e;
      });
      expect(captured).toBe('error');
      expect(result).toBe(original);
    });

    it('does not call function for ok', () => {
      let called = false;
      const result = tapErr(ok(42), () => {
        called = true;
      });
      expect(called).toBe(false);
      expect(isOk(result)).toBe(true);
    });
  });

  describe('array utilities', () => {
    it('allOk returns true when all ok', () => {
      expect(allOk([ok(1), ok(2), ok(3)])).toBe(true);
    });

    it('allOk returns false when any err', () => {
      expect(allOk([ok(1), err('e'), ok(3)])).toBe(false);
    });

    it('anyErr returns true when any err', () => {
      expect(anyErr([ok(1), err('e'), ok(3)])).toBe(true);
    });

    it('anyErr returns false when all ok', () => {
      expect(anyErr([ok(1), ok(2), ok(3)])).toBe(false);
    });

    it('filterOk extracts ok values', () => {
      const results = [ok(1), err('e'), ok(3)];
      expect(filterOk(results)).toEqual([1, 3]);
    });

    it('filterErr extracts err values', () => {
      const results = [ok(1), err('a'), ok(3), err('b')];
      expect(filterErr(results)).toEqual(['a', 'b']);
    });
  });
});

// =============================================================================
// Error Constructor Tests
// =============================================================================

describe('Error constructors', () => {
  describe('Storage errors', () => {
    it('creates storageNotFound with key', () => {
      const error = storageNotFound('test-key');
      expect(error.kind).toBe('StorageError');
      expect(error.code).toBe('STORAGE_NOT_FOUND');
      expect(error.key).toBe('test-key');
      expect(error.timestamp).toBeGreaterThan(0);
    });

    it('creates storageQuotaExceeded with usage info', () => {
      const error = storageQuotaExceeded(1000, 5000);
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.usageBytes).toBe(1000);
      expect(error.limitBytes).toBe(5000);
    });

    it('creates storageCorrupted with validation errors', () => {
      const error = storageCorrupted('key', ['invalid field', 'missing data']);
      expect(error.code).toBe('STORAGE_CORRUPTED');
      expect(error.validationErrors).toEqual(['invalid field', 'missing data']);
    });
  });

  describe('Validation errors', () => {
    it('creates validationCollision with bin IDs', () => {
      const error = validationCollision(['bin-1', 'bin-2']);
      expect(error.kind).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_COLLISION');
      expect(error.collidingBinIds).toEqual(['bin-1', 'bin-2']);
    });

    it('creates validationOutOfBounds with reason', () => {
      const error = validationOutOfBounds('exceeds_width', { x: 5, y: 0, width: 10, depth: 2 });
      expect(error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
      expect(error.reason).toBe('exceeds_width');
      expect(error.binData).toEqual({ x: 5, y: 0, width: 10, depth: 2 });
    });
  });

  describe('Layout errors', () => {
    it('creates layoutLayerLimit with counts', () => {
      const error = layoutLayerLimit(10, 10);
      expect(error.kind).toBe('LayoutError');
      expect(error.code).toBe('LAYOUT_LAYER_LIMIT');
      expect(error.currentCount).toBe(10);
      expect(error.maxCount).toBe(10);
    });

    it('creates layoutLastEntity with entity type and metadata', () => {
      const error = layoutLastEntity('layer');
      expect(error.code).toBe('LAYOUT_LAST_ENTITY');
      expect(error.entityType).toBe('layer');
      expect(error.metadata).toEqual({ entityType: 'layer' });
    });
  });

  describe('API errors', () => {
    it('creates apiRateLimited with retry info', () => {
      const error = apiRateLimited(60);
      expect(error.kind).toBe('ApiError');
      expect(error.code).toBe('API_RATE_LIMITED');
      expect(error.retryAfter).toBe(60);
      expect(error.metadata).toEqual({ retryAfter: 60 });
    });

    it('creates apiNetworkError with cause', () => {
      const cause = new Error('fetch failed');
      const error = apiNetworkError(cause);
      expect(error.code).toBe('API_NETWORK_ERROR');
      expect(error.cause).toBe(cause);
    });
  });

  describe('Unknown errors', () => {
    it('creates unknownError with cause', () => {
      const cause = new TypeError('unexpected');
      const error = unknownError(cause);
      expect(error.kind).toBe('UnknownError');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.cause).toBe(cause);
    });

    it('fromUnknown wraps any error', () => {
      const error = fromUnknown('string error');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.cause).toBe('string error');
    });
  });
});

// =============================================================================
// Error Catalog Tests
// =============================================================================

describe('Error catalog', () => {
  describe('getErrorInfo()', () => {
    it('returns catalog entry for known code', () => {
      const info = getErrorInfo('STORAGE_NOT_FOUND');
      expect(info.code).toBe('STORAGE_NOT_FOUND');
      expect(info.userMessage).toBe('Layout not found');
    });

    it('returns UNKNOWN_ERROR for unknown code', () => {
      const info = getErrorInfo('TOTALLY_FAKE_CODE');
      expect(info.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('getUserMessage()', () => {
    it('returns user message for error', () => {
      const error = storageNotFound('key');
      const message = getUserMessage(error);
      expect(message).toBe('Layout not found');
    });

    it('interpolates metadata variables', () => {
      const error = layoutLastEntity('layer');
      const message = getUserMessage(error);
      expect(message).toBe('Cannot delete the only layer');
    });
  });

  describe('getRecoveryHint()', () => {
    it('returns recovery hint for error', () => {
      const error = storageNotFound('key');
      const hint = getRecoveryHint(error);
      expect(hint).toBe('The layout may have been deleted');
    });

    it('interpolates metadata in hints', () => {
      const error = apiRateLimited(60);
      const hint = getRecoveryHint(error);
      expect(hint).toBe('Wait 60 seconds before retrying');
    });
  });

  describe('formatErrorMessage()', () => {
    it('replaces single variable', () => {
      const result = formatErrorMessage('Hello {name}', { name: 'World' });
      expect(result).toBe('Hello World');
    });

    it('replaces multiple variables', () => {
      const result = formatErrorMessage('{a} + {b} = {c}', { a: 1, b: 2, c: 3 });
      expect(result).toBe('1 + 2 = 3');
    });

    it('preserves unmatched placeholders', () => {
      const result = formatErrorMessage('Hello {name}', {});
      expect(result).toBe('Hello {name}');
    });

    it('handles no variables', () => {
      const result = formatErrorMessage('No variables here');
      expect(result).toBe('No variables here');
    });
  });

  describe('isRetryable()', () => {
    it('returns true for retryable errors', () => {
      expect(isRetryable('API_RATE_LIMITED')).toBe(true);
      expect(isRetryable('API_NETWORK_ERROR')).toBe(true);
      expect(isRetryable('STORAGE_UNAVAILABLE')).toBe(true);
    });

    it('returns false for non-retryable errors', () => {
      expect(isRetryable('STORAGE_NOT_FOUND')).toBe(false);
      expect(isRetryable('VALIDATION_COLLISION')).toBe(false);
    });
  });

  describe('getSeverity()', () => {
    it('returns error for severe issues', () => {
      expect(getSeverity('STORAGE_CORRUPTED')).toBe('error');
      expect(getSeverity('API_SERVER_ERROR')).toBe('error');
    });

    it('returns warning for less severe issues', () => {
      expect(getSeverity('VALIDATION_COLLISION')).toBe('warning');
      expect(getSeverity('LAYOUT_LAYER_LIMIT')).toBe('warning');
    });
  });
});

// =============================================================================
// Type Safety Tests (compile-time)
// =============================================================================

describe('Type safety', () => {
  it('Result type narrows correctly with isOk', () => {
    const result: Result<string, StorageError> = ok('test');

    if (isOk(result)) {
      // Should compile - value is string
      const value: string = result.value;
      expect(value).toBe('test');
    }
  });

  it('Result type narrows correctly with isErr', () => {
    const result: Result<string, StorageError> = err(storageNotFound('key'));

    if (isErr(result)) {
      // Should compile - error is StorageError
      const code: string = result.error.code;
      expect(code).toBe('STORAGE_NOT_FOUND');
    }
  });

  it('match exhaustively handles both cases', () => {
    const result: Result<number, string> = ok(42);

    // Both branches must return the same type
    const output: string = match(result, {
      ok: (v) => `ok: ${v}`,
      err: (e) => `err: ${e}`,
    });

    expect(output).toBe('ok: 42');
  });

  it('flatMap preserves error type through chain', () => {
    type MyError = ValidationError;

    const step1 = (n: number): Result<number, MyError> => ok(n * 2);
    const step2 = (n: number): Result<string, MyError> => ok(String(n));

    const result: Result<string, MyError> = flatMap(step1(5), step2);

    expect(unwrap(result)).toBe('10');
  });
});
